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

/** Vrai quand la session vient du lien de démonstration (aucun compte créé). */
export async function isDemoSession() {
  return (await readSession())?.demo === true;
}

/**
 * Refus commun aux actions qu'on ne laisse pas faire en démonstration :
 * tout ce qui touche au compte, à l'équipe ou à l'abonnement. Le reste
 * (plan, carte, soirées, service) reste manipulable : c'est l'intérêt de la démo.
 */
export async function refuseInDemo(): Promise<{ error: string } | null> {
  return (await isDemoSession())
    ? { error: "Mode démonstration : cette action est désactivée. Créez votre espace pour l'utiliser." }
    : null;
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
  const demo = await isDemoSession();
  const membership = await db.membership.findFirst({ where: { userId: user.id }, include: { venue: true }, orderBy: { createdAt: "asc" } });
  if (!membership) redirect("/app/nouveau-club");
  if (roles && !roles.includes(membership.role)) redirect("/app?erreur=acces");
  // Garde-fou : un jeton de démonstration ne donne accès qu'à l'établissement de démonstration.
  if (demo && !membership.venue.isDemo) redirect("/connexion");
  return { user, membership, venue: membership.venue, demo };
}

export const MANAGE: Role[] = ["OWNER", "DIRECTOR"];
