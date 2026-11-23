import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Départ de la connexion Google : on pose un état anti-rejeu puis on redirige vers Google. */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/connexion?erreur=google", req.url));

  const url = new URL(req.url);
  const state = randomBytes(16).toString("base64url");
  const invite = url.searchParams.get("invite")?.slice(0, 500) ?? "";

  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("tablo_oauth_state", state, opts);
  jar.set("tablo_oauth_invite", invite, opts);

  const go = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  go.searchParams.set("client_id", clientId);
  go.searchParams.set("redirect_uri", new URL("/auth/google/callback", url.origin).toString());
  go.searchParams.set("response_type", "code");
  go.searchParams.set("scope", "openid email profile");
  go.searchParams.set("state", state);
  go.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(go);
}
