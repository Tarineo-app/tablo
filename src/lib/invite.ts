import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Lien d'invitation signé (aucune table en base) : valable 7 jours.
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function signInvite(userId: string, venueId: string) {
  return new SignJWT({ userId, venueId, purpose: "invite" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key());
}

export async function readInvite(token: string): Promise<{ userId: string; venueId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "invite" || typeof payload.userId !== "string" || typeof payload.venueId !== "string") return null;
    return { userId: payload.userId, venueId: payload.venueId };
  } catch {
    return null;
  }
}
