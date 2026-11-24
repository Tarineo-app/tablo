import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "tablo_session";
const DAYS = 30;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string, opts: { demo?: boolean } = {}) {
  // Une visite de démonstration ne dure qu'un moment, et ne doit pas traîner sur la machine.
  const expires = new Date(Date.now() + (opts.demo ? 1 : DAYS * 24) * 3600e3);
  // `purpose` empêche qu'un autre jeton signé avec la même clé (invitation, cagnotte…)
  // soit accepté comme cookie de session.
  const token = await new SignJWT({ userId, purpose: "session", ...(opts.demo ? { demo: true } : {}) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expires).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function readSession(): Promise<{ userId: string; demo: boolean } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "session" || typeof payload.userId !== "string") return null;
    return { userId: payload.userId, demo: payload.demo === true };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}
