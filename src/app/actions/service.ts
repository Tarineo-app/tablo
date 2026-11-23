"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth";

/** Serveur : « Je prends » puis « Servi ». */
export async function takeOrder(orderId: string) {
  const { venue, membership } = await requireMembership();
  const o = await db.order.findFirst({ where: { id: orderId, venueId: venue.id } });
  if (!o) return { error: "Envoi introuvable." };
  if (o.status !== "NEW") return { error: "Cet envoi est déjà pris." };
  await db.order.update({ where: { id: o.id }, data: { status: "TAKEN", takenById: membership.id } });
  revalidatePath("/app/service");
  return { ok: "Pris." };
}

export async function serveOrder(orderId: string) {
  const { venue, membership } = await requireMembership();
  const o = await db.order.findFirst({ where: { id: orderId, venueId: venue.id } });
  if (!o) return { error: "Envoi introuvable." };
  await db.order.update({ where: { id: o.id }, data: { status: "SERVED", servedAt: new Date(), takenById: o.takenById ?? membership.id } });
  revalidatePath("/app/service");
  return { ok: "Servi." };
}
