"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth";
import { toCents } from "@/lib/money";

export type FloorState = { error?: string; ok?: string } | undefined;

/** Le client est arrivé : on marque le carré. */
export async function checkIn(reservationId: string) {
  const { venue } = await requireMembership();
  const r = await db.reservation.findFirst({ where: { id: reservationId, venueId: venue.id } });
  if (!r) return { error: "Réservation introuvable." };
  await db.reservation.update({ where: { id: r.id }, data: { status: r.status === "CHECKED_IN" ? "CONFIRMED" : "CHECKED_IN" } });
  revalidatePath("/app");
  return { ok: r.status === "CHECKED_IN" ? "Arrivée annulée." : "Carré marqué arrivé." };
}

export async function markNoShow(reservationId: string) {
  const { venue } = await requireMembership();
  const r = await db.reservation.findFirst({ where: { id: reservationId, venueId: venue.id } });
  if (!r) return { error: "Réservation introuvable." };
  await db.reservation.update({ where: { id: r.id }, data: { status: r.status === "NO_SHOW" ? "CONFIRMED" : "NO_SHOW" } });
  revalidatePath("/app");
  return { ok: r.status === "NO_SHOW" ? "Absence annulée." : "Carré marqué absent." };
}

const WalkIn = z.object({
  eventId: z.string().min(1),
  tableId: z.string().min(1),
  guests: z.coerce.number().int().min(1).max(60),
  name: z.string().trim().min(2, "Indiquez un nom.").max(80),
  phone: z.string().trim().max(30).optional(),
  amount: z.string().trim().optional(),
});

/**
 * Client qui arrive sans réservation : on lui attribue un carré tout de suite.
 * Le détail des bouteilles se fait ensuite, comme pour une réservation en ligne.
 */
export async function createWalkIn(_: FloorState, form: FormData): Promise<FloorState> {
  const { venue, membership } = await requireMembership(["OWNER", "DIRECTOR", "MANAGER"]);
  const p = WalkIn.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const [event, table] = await Promise.all([
    db.event.findFirst({ where: { id: d.eventId, venueId: venue.id } }),
    db.venueTable.findFirst({ where: { id: d.tableId, venueId: venue.id, active: true }, include: { category: true } }),
  ]);
  if (!event || !table) return { error: "Soirée ou carré introuvable." };
  if (d.guests > table.capacity) return { error: `Ce carré accueille ${table.capacity} personnes maximum.` };

  const total = Math.max(0, d.amount ? toCents(d.amount) : 0);
  try {
    await db.$transaction(async (tx) => {
      const taken = await tx.reservation.count({ where: { eventId: event.id, tableId: table.id, status: { notIn: ["CANCELLED", "NO_SHOW"] } } });
      if (taken) throw new Error("TAKEN");
      await tx.reservation.create({
        data: {
          venueId: venue.id, eventId: event.id, tableId: table.id,
          managerId: membership.role === "MANAGER" ? membership.id : null,
          status: "CHECKED_IN", payMode: "CASH", guests: d.guests,
          organizerName: d.name, organizerEmail: "", organizerPhone: d.phone || "",
          totalCents: total, depositCents: 0, paidCents: 0,
          qrToken: randomBytes(9).toString("base64url"),
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "TAKEN") return { error: "Ce carré est déjà pris ce soir." };
    throw e;
  }
  revalidatePath("/app");
  return { ok: `${d.name} installé en ${table.name}.` };
}
