"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { gateFor } from "@/lib/billing";
import { MANAGE, requireMembership } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";
import { SOLD, fmtTime, tierDeadline, tierLabel } from "@/lib/tickets";
import type { ActionState } from "./club";

/* ---------- Côté club : les tarifs d'une soirée ---------- */

const TierSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom au tarif.").max(60),
  price: z.string().trim().min(1, "Indiquez un prix."),
  drinks: z.coerce.number().int().min(0).max(10),
  untilTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Heure invalide.").optional(),
  quota: z.string().regex(/^\d*$/, "Nombre de places invalide.").optional(),
});

export async function addTier(eventId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const event = await db.event.findFirst({ where: { id: eventId, venueId: venue.id } });
  if (!event) return { error: "Soirée introuvable." };
  const p = TierSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const priceCents = toCents(p.data.price);
  if (priceCents < 0) return { error: "Prix invalide." };
  const count = await db.ticketTier.count({ where: { eventId } });
  await db.ticketTier.create({
    data: { eventId, name: p.data.name, priceCents, drinks: p.data.drinks, untilTime: p.data.untilTime || null, quota: p.data.quota ? Number(p.data.quota) : null, sortOrder: count },
  });
  revalidatePath(`/app/soirees/${eventId}`);
  return { ok: "Tarif ajouté." };
}

export async function toggleTier(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const t = await db.ticketTier.findFirst({ where: { id, event: { venueId: venue.id } } });
  if (t) await db.ticketTier.update({ where: { id }, data: { active: !t.active } });
  if (t) revalidatePath(`/app/soirees/${t.eventId}`);
}

export async function deleteTier(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const t = await db.ticketTier.findFirst({ where: { id, event: { venueId: venue.id } }, include: { _count: { select: { tickets: true } } } });
  if (!t) return { error: "Tarif introuvable." };
  // Un tarif déjà vendu n'est pas supprimé : on arrête juste de le vendre.
  if (t._count.tickets) await db.ticketTier.update({ where: { id }, data: { active: false } });
  else await db.ticketTier.delete({ where: { id } });
  revalidatePath(`/app/soirees/${t.eventId}`);
  return { ok: t._count.tickets ? "Tarif déjà vendu : il est désactivé." : "Tarif supprimé." };
}

/** Recopie les tarifs d'une autre soirée (gain de temps d'une semaine sur l'autre). */
export async function copyTiers(eventId: string, fromEventId: string) {
  const { venue } = await requireMembership(MANAGE);
  const [to, from] = await Promise.all([
    db.event.findFirst({ where: { id: eventId, venueId: venue.id } }),
    db.event.findFirst({ where: { id: fromEventId, venueId: venue.id }, include: { ticketTiers: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  if (!to || !from) return { error: "Soirée introuvable." };
  if (!from.ticketTiers.length) return { error: "Cette soirée n'a pas de tarifs." };
  const start = await db.ticketTier.count({ where: { eventId } });
  await db.ticketTier.createMany({ data: from.ticketTiers.map((t, i) => ({ eventId, name: t.name, priceCents: t.priceCents, drinks: t.drinks, untilTime: t.untilTime, quota: t.quota, sortOrder: start + i })) });
  revalidatePath(`/app/soirees/${eventId}`);
  return { ok: "Tarifs copiés." };
}

/* ---------- Côté client : acheter des entrées ---------- */

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I : facile à taper à l'entrée
const newCode = () => Array.from({ length: 8 }, () => ALPHA[randomInt(ALPHA.length)]).join("");

const BuySchema = z.object({
  slug: z.string().min(1),
  eventId: z.string().min(1),
  tierId: z.string().min(1),
  quantity: z.number().int().min(1, "Choisissez au moins une entrée.").max(20, "20 entrées maximum par commande."),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  phone: z.string().trim().max(30).nullable(),
  managerCode: z.string().max(40).nullable(),
});

export async function buyTickets(raw: z.infer<typeof BuySchema>): Promise<{ error: string } | { token: string }> {
  const p = BuySchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const tooMany = await rateLimit("billets", d.slug, 15, 10 * 60e3);
  if (tooMany) return { error: tooMany };
  const venue = await db.venue.findUnique({ where: { slug: d.slug } });
  if (!venue) return { error: "Établissement introuvable." };
  const gate = gateFor(venue, d.eventId);
  if (!gate.open) return { error: gate.message ?? "La billetterie n'est pas ouverte." };
  const tier = await db.ticketTier.findFirst({ where: { id: d.tierId, eventId: d.eventId, active: true, event: { venueId: venue.id, isOpen: true } }, include: { event: true } });
  if (!tier) return { error: "Ce tarif n'est plus disponible." };
  const deadline = tierDeadline(tier.event.date, tier.untilTime);
  if (deadline && deadline.getTime() < Date.now()) return { error: `Ce tarif était valable pour une arrivée avant ${fmtTime(tier.untilTime!)}. Choisissez-en un autre.` };
  if (tier.event.date.getTime() < Date.now() - 24 * 3600e3) return { error: "Cette soirée est terminée." };

  const manager = d.managerCode ? await db.membership.findFirst({ where: { managerCode: d.managerCode, venueId: venue.id, role: "MANAGER" } }) : null;
  const token = newCode();
  try {
    await db.$transaction(async (tx) => {
      if (tier.quota !== null) {
        const sold = await tx.ticket.aggregate({ where: { tierId: tier.id, status: { in: [...SOLD] } }, _sum: { quantity: true } });
        const left = tier.quota - (sold._sum.quantity ?? 0);
        if (left < d.quantity) throw new Error(`LEFT:${Math.max(0, left)}`);
      }
      await tx.ticket.create({
        data: {
          venueId: venue.id, eventId: tier.eventId, tierId: tier.id, managerId: manager?.id ?? null,
          quantity: d.quantity, totalCents: tier.priceCents * d.quantity,
          buyerName: d.name, buyerEmail: d.email, buyerPhone: d.phone || null, qrToken: token,
          // Entrée gratuite : rien à payer, le billet est valable tout de suite.
          status: tier.priceCents === 0 ? "PAID" : "PENDING",
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("LEFT:")) {
      const left = Number(e.message.slice(5));
      return { error: left ? `Il ne reste que ${left} place${left > 1 ? "s" : ""} à ce tarif.` : "Ce tarif est complet." };
    }
    throw e;
  }
  return { token };
}

/* ---------- À l'entrée : contrôle des billets et des carrés ---------- */

export type DoorResult =
  | { error: string }
  | {
      kind: "ticket" | "table";
      id: string;
      name: string;
      detail: string;
      quantity: number;
      checkedIn: number;
      warnings: string[];
      ok: boolean;
    };

const sameNight = (eventDate: Date) => {
  // La soirée du jour J se termine le lendemain midi.
  const start = eventDate.getTime() - 12 * 3600e3, end = eventDate.getTime() + 24 * 3600e3;
  return Date.now() >= start && Date.now() <= end;
};

export async function lookupCode(code: string): Promise<DoorResult> {
  const { venue } = await requireMembership();
  const c = code.trim();
  if (c.length < 6) return { error: "Code trop court." };
  // Freine une recherche de codes au hasard depuis un compte compromis.
  const tooMany = await rateLimit("porte", venue.id, 120, 60e3);
  if (tooMany) return { error: tooMany };
  const t = await db.ticket.findFirst({ where: { venueId: venue.id, qrToken: { in: [c, c.toUpperCase()] } }, include: { tier: true, event: true } });
  if (t) {
    const warnings: string[] = [];
    if (t.status === "CANCELLED") warnings.push("Billet annulé.");
    if (t.status === "PENDING") warnings.push("Paiement non reçu.");
    if (!sameNight(t.event.date)) warnings.push(`Billet pour une autre soirée (${t.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })}).`);
    const dl = tierDeadline(t.event.date, t.tier.untilTime);
    if (dl && Date.now() > dl.getTime()) warnings.push(`Arrivée après ${fmtTime(t.tier.untilTime!)} : ce tarif n'est plus valable.`);
    if (t.checkedIn >= t.quantity) warnings.push("Toutes les personnes de ce billet sont déjà entrées.");
    return {
      kind: "ticket", id: t.id, name: t.buyerName, detail: `${t.tier.name} · ${tierLabel(t.tier)}`,
      quantity: t.quantity, checkedIn: t.checkedIn, warnings, ok: warnings.length === 0,
    };
  }
  const r = await db.reservation.findFirst({ where: { venueId: venue.id, qrToken: c }, include: { table: true, event: true } });
  if (r) {
    const warnings: string[] = [];
    if (r.status === "CANCELLED") warnings.push("Réservation annulée.");
    if (!sameNight(r.event.date)) warnings.push("Réservation pour une autre soirée.");
    if (r.status === "CHECKED_IN") warnings.push("Ce carré est déjà arrivé.");
    return { kind: "table", id: r.id, name: r.organizerName, detail: `Carré ${r.table.name} · ${r.guests} personnes`, quantity: r.guests, checkedIn: r.status === "CHECKED_IN" ? r.guests : 0, warnings, ok: warnings.length === 0 };
  }
  return { error: "Aucun billet ni carré avec ce code." };
}

export async function admit(kind: "ticket" | "table", id: string, count: number) {
  const { venue } = await requireMembership();
  if (kind === "table") {
    await db.reservation.updateMany({ where: { id, venueId: venue.id }, data: { status: "CHECKED_IN" } });
  } else {
    const t = await db.ticket.findFirst({ where: { id, venueId: venue.id } });
    if (!t) return { error: "Billet introuvable." };
    const n = Math.min(t.quantity, t.checkedIn + Math.max(1, count));
    await db.ticket.update({ where: { id }, data: { checkedIn: n, checkedInAt: t.checkedInAt ?? new Date(), status: n >= t.quantity ? "CHECKED_IN" : t.status } });
  }
  revalidatePath("/app/entree");
  return { ok: "Entrée validée." };
}

/* ---------- Revente : donner son billet, ou le rendre au club ---------- */

export type ResaleState = { error?: string; ok?: string; link?: string } | undefined;

const Transfer = z.object({
  token: z.string().min(4).max(20),
  name: z.string().trim().min(2, "Indiquez le nom de la personne.").max(80),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  phone: z.string().trim().max(30).optional(),
});

/**
 * Donner son billet à quelqu'un : l'ancien code devient invalide, un nouveau billet est créé
 * au nom du nouveau venu. Aucun argent ne passe par Tablo, les deux se règlent entre eux.
 */
export async function transferTicket(_: ResaleState, form: FormData): Promise<ResaleState> {
  const p = Transfer.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const tooMany = await rateLimit("transfert", d.token, 5, 60 * 60e3);
  if (tooMany) return { error: tooMany };

  const t = await db.ticket.findUnique({ where: { qrToken: d.token.toUpperCase() }, include: { venue: true, event: true } });
  if (!t) return { error: "Billet introuvable." };
  if (!t.venue.ticketTransfer) return { error: "Ce club ne permet pas de donner son billet." };
  if (t.status === "TRANSFERRED") return { error: "Ce billet a déjà été donné." };
  if (t.status === "RETURNED") return { error: "Ce billet a été rendu au club." };
  if (t.status === "CANCELLED") return { error: "Ce billet est annulé." };
  if (t.checkedIn > 0) return { error: "Une partie du groupe est déjà entrée : voyez avec le club." };
  if (t.event.date.getTime() < Date.now() - 12 * 3600e3) return { error: "Cette soirée est passée." };

  const token = newCode();
  await db.$transaction(async (tx) => {
    const still = await tx.ticket.updateMany({ where: { id: t.id, status: { in: ["PENDING", "PAID"] } }, data: { status: "TRANSFERRED" } });
    if (still.count === 0) throw new Error("GONE");
    await tx.ticket.create({
      data: {
        venueId: t.venueId, eventId: t.eventId, tierId: t.tierId, managerId: t.managerId,
        status: t.status, quantity: t.quantity, totalCents: t.totalCents,
        buyerName: d.name, buyerEmail: d.email, buyerPhone: d.phone || null,
        qrToken: token, fromTicketId: t.id,
      },
    });
  }).catch((e) => { if (!(e instanceof Error && e.message === "GONE")) throw e; });

  const fresh = await db.ticket.findUnique({ where: { qrToken: token } });
  if (!fresh) return { error: "Ce billet n'est plus transférable." };
  return { ok: `Le billet est maintenant au nom de ${d.name}. Envoyez-lui ce lien :`, link: `/w/${t.venue.slug}/b/${token}` };
}

/** Rendre son billet au club, quand le club le permet et que le délai est respecté. */
export async function returnTicket(token: string): Promise<ResaleState> {
  const tooMany = await rateLimit("reprise", token, 5, 60 * 60e3);
  if (tooMany) return { error: tooMany };
  const t = await db.ticket.findUnique({ where: { qrToken: token.toUpperCase() }, include: { venue: true, event: true } });
  if (!t) return { error: "Billet introuvable." };
  if (!t.venue.ticketBuyback) return { error: "Ce club ne reprend pas les billets." };
  if (!["PENDING", "PAID"].includes(t.status)) return { error: "Ce billet n'est plus valable." };
  const limit = t.event.date.getTime() - t.venue.ticketBuybackHours * 3600e3;
  if (Date.now() > limit)
    return { error: `Le club reprend les billets jusqu'à ${t.venue.ticketBuybackHours} h avant la soirée. Le délai est passé.` };

  const refund = t.status === "PAID" ? Math.round((t.totalCents * Math.min(100, t.venue.ticketBuybackPct)) / 100) : 0;
  const done = await db.ticket.updateMany({ where: { id: t.id, status: { in: ["PENDING", "PAID"] } }, data: { status: "RETURNED", returnedAt: new Date(), refundCents: refund } });
  if (done.count === 0) return { error: "Ce billet vient de changer d'état." };
  return {
    ok: refund
      ? `Billet rendu. Le club vous rembourse ${(refund / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}, votre place est remise en vente.`
      : "Billet rendu. Votre place est remise en vente.",
  };
}

/** Côté club : marquer le remboursement comme fait. */
export async function markRefunded(id: string) {
  const { venue } = await requireMembership(MANAGE);
  await db.ticket.updateMany({ where: { id, venueId: venue.id, status: "RETURNED" }, data: { refundCents: 0 } });
  revalidatePath("/app/ventes");
  return { ok: "Remboursement noté." };
}

const Resale = z.object({
  ticketTransfer: z.string().optional(),
  ticketBuyback: z.string().optional(),
  ticketBuybackHours: z.coerce.number().int().min(0).max(720),
  ticketBuybackPct: z.coerce.number().int().min(0).max(100),
});

export async function saveResaleSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = Resale.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.venue.update({
    where: { id: venue.id },
    data: {
      ticketTransfer: p.data.ticketTransfer === "on",
      ticketBuyback: p.data.ticketBuyback === "on",
      ticketBuybackHours: p.data.ticketBuybackHours,
      ticketBuybackPct: p.data.ticketBuybackPct,
    },
  });
  revalidatePath("/app/soirees");
  return { ok: "Réglages enregistrés." };
}
