"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { gateFor } from "@/lib/billing";
import { refuseInDemo, requireMembership } from "@/lib/auth";
import { listTotal, offerCode } from "@/lib/offers";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { depositCents } from "@/lib/pricing";
import { occupying } from "@/lib/holds";
import { holdFromNow, paymentsReady } from "@/lib/stripe";
import { emailConfigured } from "@/lib/email";
import { sendOfferRequested, sendOfferToClient } from "@/lib/notify";

export type OfferState = { error?: string; ok?: string; code?: string } | undefined;

const Line = z.object({
  bottleSizeId: z.string().nullable().optional(),
  showId: z.string().nullable().optional(),
  flavor: z.string().trim().max(40).nullable().optional(),
  quantity: z.number().int().min(1).max(50),
  offered: z.boolean().default(false),
});

const Compose = z.object({
  offerId: z.string().optional(),
  eventId: z.string().min(1, "Choisissez une soirée."),
  tableId: z.string().min(1).nullable(),
  guests: z.number().int().min(1).max(100),
  lines: z.array(Line).max(40),
  signText: z.string().trim().max(40).nullable(),
  priceCents: z.number().int().min(0).max(100_000_00),
  message: z.string().trim().max(600).nullable(),
  clientName: z.string().trim().max(80).nullable(),
  clientPhone: z.string().trim().max(30).nullable(),
  clientEmail: z.string().trim().toLowerCase().max(120).nullable(),
  days: z.number().int().min(1).max(30).default(7),
});

/**
 * Le manager compose l'offre et fixe SON prix. Les prix publics servent de
 * référence : l'écart est ce qu'il offre, et c'est son argument de vente.
 */
export async function saveOffer(raw: z.infer<typeof Compose>): Promise<OfferState> {
  const { venue, membership } = await requireMembership();
  const p = Compose.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const event = await db.event.findFirst({ where: { id: d.eventId, venueId: venue.id }, select: { id: true } });
  if (!event) return { error: "Cette soirée n'existe pas." };
  if (d.tableId) {
    const t = await db.venueTable.findFirst({ where: { id: d.tableId, venueId: venue.id }, select: { id: true } });
    if (!t) return { error: "Ce carré n'existe pas." };
  }

  // Les prix viennent de la base, jamais du navigateur.
  const sizeIds = d.lines.map((l) => l.bottleSizeId).filter((v): v is string => !!v);
  const showIds = d.lines.map((l) => l.showId).filter((v): v is string => !!v);
  const [sizes, shows] = await Promise.all([
    db.bottleSize.findMany({ where: { id: { in: sizeIds }, bottle: { venueId: venue.id } }, select: { id: true, priceCents: true } }),
    db.show.findMany({ where: { id: { in: showIds }, venueId: venue.id }, select: { id: true, priceCents: true } }),
  ]);
  const priceOf = new Map<string, number>([...sizes.map((x) => [x.id, x.priceCents] as const), ...shows.map((x) => [x.id, x.priceCents] as const)]);

  const items = d.lines.map((l, i) => {
    const key = l.bottleSizeId ?? l.showId ?? "";
    if (!priceOf.has(key)) return null;
    return {
      bottleSizeId: l.bottleSizeId ?? null,
      showId: l.showId ?? null,
      flavor: l.flavor ?? null,
      quantity: l.quantity,
      unitCents: priceOf.get(key)!,
      offered: l.offered,
      sortOrder: i,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length !== d.lines.length) return { error: "Une bouteille ou un show n'appartient pas à ce club." };

  const expiresAt = new Date(Date.now() + d.days * 864e5);
  const data = {
    eventId: d.eventId, tableId: d.tableId, guests: d.guests, signText: d.signText,
    priceCents: d.priceCents, listCents: listTotal(items),
    message: d.message, clientName: d.clientName, clientPhone: d.clientPhone, clientEmail: d.clientEmail || null,
    expiresAt, status: "SENT" as const, sentAt: new Date(),
  };

  if (d.offerId) {
    const existing = await db.offer.findFirst({ where: { id: d.offerId, venueId: venue.id }, select: { id: true, status: true, code: true } });
    if (!existing) return { error: "Cette offre n'existe pas." };
    if (existing.status === "ACCEPTED") return { error: "Cette offre a déjà été acceptée." };
    await db.$transaction([
      db.offerItem.deleteMany({ where: { offerId: existing.id } }),
      db.offer.update({ where: { id: existing.id }, data: { ...data, managerId: membership.role === "MANAGER" ? membership.id : undefined, items: { create: items } } }),
    ]);
    revalidatePath("/app/offres");
    return { ok: "Offre mise à jour.", code: existing.code };
  }

  const code = offerCode();
  await db.offer.create({
    data: { ...data, venueId: venue.id, managerId: membership.id, code, items: { create: items } },
  });
  revalidatePath("/app/offres");
  return { ok: "Offre prête à envoyer.", code };
}

export async function cancelOffer(id: string): Promise<OfferState> {
  const { venue } = await requireMembership();
  const r = await db.offer.updateMany({ where: { id, venueId: venue.id, status: { in: ["SENT", "REQUESTED"] } }, data: { status: "CANCELLED", decidedAt: new Date() } });
  if (r.count === 0) return { error: "Cette offre ne peut plus être annulée." };
  revalidatePath("/app/offres");
  return { ok: "Offre annulée." };
}

/* ------------------------------------------------------------------ */
/* Côté client : demander une offre, puis l'accepter.                  */
/* ------------------------------------------------------------------ */

const Ask = z.object({
  slug: z.string().min(1),
  eventId: z.string().min(1),
  tableId: z.string().nullable(),
  guests: z.number().int().min(1).max(100),
  note: z.string().trim().max(600).nullable(),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  phone: z.string().trim().min(6, "Téléphone invalide.").max(30),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  managerCode: z.string().max(40).nullable(),
});

/** Le client décrit ce qu'il veut ; le manager chiffre derrière. */
export async function requestOffer(raw: z.infer<typeof Ask>): Promise<OfferState> {
  const p = Ask.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const tooMany = await rateLimit("offre", await callerIp(), 6, 60 * 60_000);
  if (tooMany) return { error: tooMany };

  const venue = await db.venue.findUnique({ where: { slug: d.slug } });
  if (!venue) return { error: "Établissement introuvable." };
  const gate = gateFor(venue, d.eventId);
  if (!gate.open) return { error: gate.message ?? "Les demandes ne sont pas ouvertes." };

  const event = await db.event.findFirst({ where: { id: d.eventId, venueId: venue.id }, select: { id: true } });
  if (!event) return { error: "Cette soirée n'existe pas." };
  const manager = d.managerCode
    ? await db.membership.findFirst({ where: { managerCode: d.managerCode, venueId: venue.id }, select: { id: true } })
    : null;

  const code = offerCode();
  const created = await db.offer.create({
    data: {
      venueId: venue.id, eventId: d.eventId, tableId: d.tableId, managerId: manager?.id ?? null,
      status: "REQUESTED", code, guests: d.guests, askNote: d.note,
      clientName: d.name, clientPhone: d.phone, clientEmail: d.email,
    },
  });
  await sendOfferRequested(created.id);
  revalidatePath("/app/offres");
  return { ok: "C'est noté. Votre manager revient vers vous avec une proposition.", code };
}

/** Le client accepte : l'offre devient une réservation, au prix du manager. */
export async function acceptOffer(code: string, payMode: "FULL" | "CASH"): Promise<{ error?: string; token?: string }> {
  const tooMany = await rateLimit("offre-ok", await callerIp(), 20, 10 * 60_000);
  if (tooMany) return { error: tooMany };

  const offer = await db.offer.findUnique({
    where: { code },
    include: { venue: true, items: true },
  });
  if (!offer) return { error: "Cette offre n'existe pas." };
  if (offer.status === "ACCEPTED") return { error: "Cette offre a déjà été acceptée." };
  if (offer.status !== "SENT") return { error: "Cette offre n'est plus valable." };
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) return { error: "Cette offre a expiré. Demandez-en une nouvelle à votre manager." };
  if (!offer.tableId) return { error: "Cette offre n'a pas de carré. Demandez à votre manager de la compléter." };
  if (!offer.clientName || !offer.clientEmail || !offer.clientPhone) return { error: "Il manque vos coordonnées sur cette offre." };

  const gate = gateFor(offer.venue, offer.eventId);
  if (!gate.open) return { error: gate.message ?? "Les réservations ne sont pas ouvertes." };
  if (!offer.venue.payModes.includes(payMode)) return { error: "Ce mode de paiement n'est pas proposé par le club." };

  const taken = await db.reservation.findFirst({
    where: { eventId: offer.eventId, tableId: offer.tableId, ...occupying(["NO_SHOW"]) },
    select: { id: true },
  });
  if (taken) return { error: "Ce carré vient d'être réservé. Votre manager va vous en proposer un autre." };

  // L'acompte suit la règle de la catégorie du carré, appliquée au prix du manager.
  const table = await db.venueTable.findFirst({ where: { id: offer.tableId, venueId: offer.venueId }, include: { category: true } });
  if (!table) return { error: "Ce carré n'existe plus. Votre manager va vous en proposer un autre." };
  const deposit = payMode === "FULL" ? offer.priceCents : depositCents(offer.priceCents, table.category.depositPct);
  const online = paymentsReady(offer.venue) && deposit > 0;
  const bottles = offer.items.filter((i) => i.bottleSizeId);
  const shows = offer.items.filter((i) => i.showId);

  const reservation = await db.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        venueId: offer.venueId, eventId: offer.eventId, tableId: offer.tableId!, managerId: offer.managerId,
        status: online ? "PENDING_PAYMENT" : "DRAFT", holdUntil: online ? holdFromNow("offer") : null, payMode, guests: offer.guests,
        organizerName: offer.clientName!, organizerEmail: offer.clientEmail!, organizerPhone: offer.clientPhone!,
        signText: offer.signText,
        totalCents: offer.priceCents, depositCents: deposit,
        shows: { create: shows.map((s) => ({ showId: s.showId!, included: s.offered, priceCents: s.offered ? 0 : s.unitCents })) },
      },
    });
    if (bottles.length > 0) {
      await tx.order.create({
        data: {
          venueId: offer.venueId, reservationId: r.id, number: 1,
          items: { create: bottles.map((b) => ({ bottleSizeId: b.bottleSizeId!, flavor: b.flavor, quantity: b.quantity, unitCents: b.offered ? 0 : b.unitCents })) },
        },
      });
    }
    await tx.offer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", decidedAt: new Date(), reservationId: r.id } });
    return r;
  });

  revalidatePath("/app");
  revalidatePath("/app/offres");
  return { token: reservation.qrToken };
}

export async function declineOffer(code: string): Promise<OfferState> {
  const r = await db.offer.updateMany({ where: { code, status: "SENT" }, data: { status: "DECLINED", decidedAt: new Date() } });
  if (r.count === 0) return { error: "Cette offre n'est plus en attente." };
  revalidatePath("/app/offres");
  return { ok: "C'est noté, merci de votre réponse." };
}

/** Le manager envoie l'offre par email au client (si son email est renseigné). */
export async function emailOffer(id: string): Promise<OfferState> {
  const { venue } = await requireMembership();
  const demo = await refuseInDemo();
  if (demo) return demo;
  if (!emailConfigured()) return { error: "L'envoi d'emails n'est pas encore branché. Envoyez le lien par WhatsApp." };
  const offer = await db.offer.findFirst({ where: { id, venueId: venue.id }, select: { id: true, status: true, clientEmail: true } });
  if (!offer) return { error: "Cette offre n'existe pas." };
  if (offer.status !== "SENT") return { error: "Seule une offre prête peut être envoyée." };
  if (!offer.clientEmail) return { error: "Ajoutez l'email du client à l'offre." };
  const tooMany = await rateLimit("offre-mail", id, 3, 60 * 60_000);
  if (tooMany) return { error: tooMany };
  return (await sendOfferToClient(offer.id)) ? { ok: "Offre envoyée par email." } : { error: "L'email n'a pas pu partir. Réessayez." };
}
