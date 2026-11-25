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
