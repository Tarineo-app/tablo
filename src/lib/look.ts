import "server-only";
import { cookies } from "next/headers";
import { AMBIANCES, defaultTheme } from "./theme";

/**
 * Réglages choisis par le prospect sur la page d'accueil (nom, ambiance, couleur…).
 * On les garde le temps de l'inscription pour que son espace démarre déjà à son image.
 */
export type Look = { club?: string; kind?: string; amb?: string; couleur?: string; boutons?: string };
const COOKIE = "tablo_look";

const clean = (v: string | undefined, max = 40) => (v ?? "").trim().slice(0, max);

export function parseLook(q: Record<string, string | string[] | undefined>): Look {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]?.[0] : q[k]) as string | undefined;
  const amb = clean(one("amb"), 16);
  const couleur = clean(one("couleur"), 9);
  const boutons = clean(one("boutons"), 8);
  return {
    club: clean(one("club"), 60) || undefined,
    kind: one("kind") === "beach" ? "beach" : one("kind") === "club" ? "club" : undefined,
    amb: amb in AMBIANCES ? amb : undefined,
    couleur: /^#[0-9a-fA-F]{6}$/.test(couleur) ? couleur : undefined,
    boutons: ["pill", "round", "square"].includes(boutons) ? boutons : undefined,
  };
}

export async function rememberLook(look: Look) {
  if (!look.club && !look.amb && !look.couleur && !look.kind) return;
  (await cookies()).set(COOKIE, JSON.stringify(look), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
}

export async function readLook(): Promise<Look> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return {};
  try { return parseLook(JSON.parse(raw)); } catch { return {}; }
}

export async function forgetLook() {
  (await cookies()).delete(COOKIE);
}

/** Thème de départ du club, à partir de ce qu'il a choisi sur la page d'accueil. */
export function themeFromLook(kind: string, look: Look) {
  const base = defaultTheme(kind) as Record<string, unknown>;
  const amb = look.amb && look.amb in AMBIANCES ? AMBIANCES[look.amb as keyof typeof AMBIANCES] : null;
  return {
    ...base,
    ...(amb ? { amb: amb.amb, mode: amb.mode, accent: amb.accent, grad: amb.grad, font: amb.font, head: amb.head, btn: amb.btn } : {}),
    ...(look.couleur ? { accent: look.couleur, grad: "" } : {}),
    ...(look.boutons ? { btn: look.boutons } : {}),
  };
}
