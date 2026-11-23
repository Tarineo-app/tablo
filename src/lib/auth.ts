import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import type { Role } from "@/generated/prisma/enums";

export async function currentUser() {
  const s = await readSession();
  if (!s) return null;
  return db.user.findUnique({ where: { id: s.userId } });
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  return user;
}

/**
 * Point d'entrée unique de l'espace club : renvoie l'utilisateur, son rôle et son établissement.
 * Toute requête métier doit ensuite filtrer par `venue.id`.
 */
export async function requireMembership(roles?: Role[]) {
  const user = await requireUser();
  const membership = await db.membership.findFirst({ where: { userId: user.id }, include: { venue: true }, orderBy: { createdAt: "asc" } });
  if (!membership) redirect("/app/nouveau-club");
  if (roles && !roles.includes(membership.role)) redirect("/app?erreur=acces");
  return { user, membership, venue: membership.venue };
}

export const MANAGE: Role[] = ["OWNER", "DIRECTOR"];
