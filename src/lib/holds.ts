import type { Prisma, ReservationStatus } from "@/generated/prisma/client";

/**
 * Les réservations qui occupent leur carré. Une réservation en attente de paiement
 * ne le tient que jusqu'à `holdUntil` : passé ce délai, le carré repart à la vente
 * même si Stripe n'a pas encore prévenu que le paiement a été abandonné.
 * (Sans `holdUntil`, par exemple une offre acceptée avant l'arrivée du paiement en ligne, elle le tient.)
 */
export function occupying(also: ReservationStatus[] = [], now = new Date()): Prisma.ReservationWhereInput {
  return {
    OR: [
      { status: { notIn: ["CANCELLED", "PENDING_PAYMENT", ...also] } },
      { status: "PENDING_PAYMENT", OR: [{ holdUntil: null }, { holdUntil: { gt: now } }] },
    ],
  };
}

/** Bouteilles déjà réservées pour une soirée, format par format (stock par soirée). */
export async function soldBySize(eventId: string): Promise<Map<string, number>> {
  const { db } = await import("./db");
  const rows = await db.orderItem.groupBy({
    by: ["bottleSizeId"],
    where: { bottleSizeId: { not: null }, fromGarage: false, order: { reservation: { eventId, ...occupying() } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.bottleSizeId!, r._sum.quantity ?? 0]));
}
export async function soldForEvent(eventId: string, sizeId: string) {
  return (await soldBySize(eventId)).get(sizeId) ?? 0;
}
