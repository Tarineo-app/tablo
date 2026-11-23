import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readInvite } from "@/lib/invite";
import { createSession } from "@/lib/session";

const fail = (url: string, code: string) => NextResponse.redirect(new URL(`/connexion?erreur=${code}`, url));

/** Retour de Google : on échange le code, on retrouve (ou crée) l'utilisateur par son email. */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(req.url, "google");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("tablo_oauth_state")?.value;
  const inviteToken = jar.get("tablo_oauth_invite")?.value;
  jar.delete("tablo_oauth_state");
  jar.delete("tablo_oauth_invite");
  if (!code || !state || !expected || state !== expected) return fail(req.url, "google");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: new URL("/auth/google/callback", url.origin).toString(),
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!res?.ok) return fail(req.url, "google");
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) return fail(req.url, "google");

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } }).catch(() => null);
  if (!infoRes?.ok) return fail(req.url, "google");
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
  if (!info.email || info.email_verified === false) return fail(req.url, "google-email");
  const email = info.email.trim().toLowerCase();

  let user = await db.user.findUnique({ where: { email } });

  // Invitation : le lien vaut pour une personne précise, on rattache le compte Google à celle-ci.
  if (inviteToken) {
    const inv = await readInvite(inviteToken);
    const invited = inv ? await db.user.findUnique({ where: { id: inv.userId } }) : null;
    if (invited) {
      if (invited.email !== email && user) return fail(req.url, "google-invitation");
      user = await db.user.update({ where: { id: invited.id }, data: { email, name: invited.name || info.name || email.split("@")[0] } });
      await createSession(user.id);
      return NextResponse.redirect(new URL("/app", url.origin));
    }
  }

  if (!user) user = await db.user.create({ data: { email, name: info.name || email.split("@")[0] } });
  else if (!user.name && info.name) user = await db.user.update({ where: { id: user.id }, data: { name: info.name } });

  await createSession(user.id);
  return NextResponse.redirect(new URL("/app", url.origin));
}
