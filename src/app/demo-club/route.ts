import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { callerIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrée dans l'espace club de démonstration, sans compte ni mot de passe.
 *
 * Trois garde-fous : il faut que DEMO_LOGIN soit activé, que l'établissement
 * porte `isDemo`, et le jeton créé porte `demo: true` — `requireMembership`
 * refuse alors tout autre établissement, et les actions sensibles sont bloquées.
 */
export async function GET() {
  if (process.env.DEMO_LOGIN !== "1") {
    return NextResponse.redirect(new URL("/connexion", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  const tooMany = await rateLimit("demo", await callerIp(), 30, 10 * 60_000);
  if (tooMany) return new NextResponse("Trop de demandes, réessayez dans quelques minutes.", { status: 429 });

  const membership = await db.membership.findFirst({
    where: { role: "OWNER", venue: { isDemo: true } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!membership) return NextResponse.redirect(new URL("/connexion?demo=absente", base));

  await createSession(membership.userId, { demo: true });
  return NextResponse.redirect(new URL("/app", base));
}
