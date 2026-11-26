"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { gateFor } from "@/lib/billing";
import { bottleCount, bottleOptionUnlocked, depositCents, priceShows } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import { occupying, soldForEvent } from "@/lib/holds";
import { holdFromNow, paymentsReady } from "@/lib/stripe";

const Input = z.object({
  slug: z.string().min(1),
  eventId: z.string().min(1),
  tableId: z.string().min(1),
  guests: z.number().int().min(1).max(100),
  items: z.array(z.object({ sizeId: z.string().min(1), flavor: z.string().max(40).nullable(), quantity: z.number().int().min(1).max(50) })).min(1, "Choisissez au moins une bouteille.").max(40),
  showIds: z.array(z.string()).max(20),
  signText: z.string().trim().max(40).nullable(),
  payMode: z.enum(["FULL", "CASH"]),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  phone: z.string().trim().min(6, "Téléphone invalide.").max(30),
  managerCode: z.string().max(40).nullable(),
  garageCode: z.string().trim().toUpperCase().max(12).nullable().optional(),
});

export type ReserveResult = { error: string } | { token: string };

/** Crée la réservation. Tous les montants sont recalculés ici : le navigateur ne fait que proposer. */
export async function createReservation(raw: z.infer<typeof Input>): Promise<ReserveResult> {
  const p = Input.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const tooMany = await rateLimit("reserve", d.slug, 10, 10 * 60e3);
  if (tooMany) return { error: tooMany };

  const venue = await db.venue.findUnique({ where: { slug: d.slug } });
  if (!venue) return { error: "Établissement introuvable." };
  if (!venue.payModes.includes(d.payMode)) return { error: "Ce mode de paiement n'est pas proposé par le club." };
  const gate = gateFor(venue, d.eventId);
  if (!gate.open) return { error: gate.message ?? "Les réservations ne sont pas ouvertes." };

  const [event, table] = await Promise.all([
    db.event.findFirst({ where: { id: d.eventId, venueId: venue.id, isOpen: true }, include: { prices: { where: { tableId: d.tableId } } } }),
    db.venueTable.findFirst({ where: { id: d.tableId, venueId: venue.id, active: true }, include: { category: true } }),
  ]);
  if (!event || event.date.getTime() < Date.now() - 12 * 3600e3) return { error: "Cette soirée n'est plus ouverte à la réservation." };
  if (!table) return { error: "Ce carré n'existe plus." };
  if (d.guests > table.capacity) return { error: `Ce carré accueille ${table.capacity} personnes maximum.` };

  // Bouteilles : on relit les prix en base.
  const sizes = await db.bottleSize.findMany({ where: { id: { in: d.items.map((i) => i.sizeId) }, bottle: { venueId: venue.id, active: true } }, include: { bottle: true } });
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  let bottlesCents = 0;
  for (const it of d.items) {
    const s = sizeById.get(it.sizeId);
    if (!s) return { error: "Une bouteille n'est plus disponible." };
    if (s.stock !== null) {
      // Le stock se compte par soirée : ce qui est déjà réservé pour cette soirée, plus cette commande.
      const sold = await soldForEvent(event.id, s.id);
      if (sold + it.quantity > s.stock) return { error: s.stock - sold > 0 ? `Plus que ${s.stock - sold} ${s.bottle.name} ${s.label} pour cette soirée.` : `${s.bottle.name} ${s.label} est épuisée pour cette soirée.` };
    }
    if (it.flavor && !s.bottle.flavors.includes(it.flavor)) return { error: `Goût inconnu pour ${s.bottle.name}.` };
    bottlesCents += s.priceCents * it.quantity;
  }
  const lines = d.items.map((it) => ({ bottleId: sizeById.get(it.sizeId)!.bottleId, quantity: it.quantity }));
  const nBottles = bottleCount(lines);

  // Garage : la bouteille gardée au club. Elle change la règle du minimum.
  const garage = d.garageCode
    ? await db.garageItem.findFirst({ where: { code: d.garageCode, venueId: venue.id }, include: { bottleSize: true } })
    : null;
  if (d.garageCode && !garage) return { error: "Le code de votre bouteille au garage n'est pas reconnu." };
  if (garage) {
    if (!venue.garageEnabled) return { error: "Ce club ne garde plus de bouteilles." };
    if (garage.status !== "STORED") return { error: "Cette bouteille a déjà été reprise." };
    if (garage.expiresAt.getTime() < Date.now()) return { error: "Le délai de conservation de votre bouteille est dépassé." };
    if (nBottles < venue.garageMinBottles)
      return { error: `Pour venir rechercher votre bouteille, le club demande au moins ${venue.garageMinBottles} bouteille${venue.garageMinBottles > 1 ? "s" : ""}.` };
  }

  let minCents = event.prices[0]?.minSpendCents ?? table.minSpendCents ?? table.category.minSpendCents;
  if (garage && !venue.garageKeepsMin) minCents = 0;
  if (bottlesCents < minCents) return { error: `Le minimum de ce carré est de ${minCents / 100} € de bouteilles.` };

  // Shows : offerts selon la catégorie, le reste est payant.
  const shows = await db.show.findMany({ where: { id: { in: d.showIds }, venueId: venue.id, active: true }, include: { categories: { select: { id: true } } } });
  if (shows.length !== new Set(d.showIds).size) return { error: "Un show n'est plus disponible." };
  for (const sh of shows) {
    if (!bottleOptionUnlocked({ minBottles: sh.minBottles, bottleId: sh.bottleId }, lines))
      return { error: `L'option « ${sh.name} » demande au moins ${sh.minBottles} bouteille${sh.minBottles > 1 ? "s" : ""} au panier.` };
  }
  const priced = priceShows(shows.map((s) => ({ id: s.id, priceCents: s.priceCents, categoryIds: s.categories.map((c) => c.id) })), table.categoryId, table.category.includedShows);
  const showsCents = priced.reduce((a, s) => a + s.priceCents, 0);
  const total = bottlesCents + showsCents;
  const deposit = d.payMode === "FULL" ? total : depositCents(total, table.category.depositPct);

  const manager = d.managerCode ? await db.membership.findFirst({ where: { managerCode: d.managerCode, venueId: venue.id, role: "MANAGER" } }) : null;
  const token = randomBytes(12).toString("base64url");
  // Paiement en ligne si le club l'a activé : le carré est tenu le temps que le client paie.
  const online = paymentsReady(venue) && deposit > 0;

  try {
    await db.$transaction(async (tx) => {
      // Vérification au dernier moment, dans la transaction : un carré, une réservation par soirée.
      const taken = await tx.reservation.count({ where: { eventId: event.id, tableId: table.id, ...occupying() } });
      if (taken) throw new Error("TAKEN");
      if (garage) {
        // Relecture dans la transaction : deux personnes ne peuvent pas reprendre la même bouteille.
        const still = await tx.garageItem.updateMany({ where: { id: garage.id, status: "STORED" }, data: { status: "RETRIEVED", retrievedAt: new Date() } });
        if (still.count === 0) throw new Error("GARAGE");
      }
      const r = await tx.reservation.create({
        data: {
          venueId: venue.id, eventId: event.id, tableId: table.id, managerId: manager?.id ?? null,
          status: online ? "PENDING_PAYMENT" : "DRAFT", holdUntil: online ? holdFromNow() : null, payMode: d.payMode, guests: d.guests,
          organizerName: d.name, organizerEmail: d.email, organizerPhone: d.phone,
          signText: d.signText || null, totalCents: total, depositCents: deposit, qrToken: token,
          garageItemId: garage?.id ?? null,
          shows: { create: priced.map((s) => ({ showId: s.id, included: s.included, priceCents: s.priceCents })) },
        },
      });
      await tx.order.create({
        data: {
          venueId: venue.id, reservationId: r.id, number: 1,
          items: {
            create: [
              ...d.items.map((it) => ({ bottleSizeId: it.sizeId, flavor: it.flavor, quantity: it.quantity, unitCents: sizeById.get(it.sizeId)!.priceCents })),
              // La bouteille du garage part avec l'envoi n°1 : le serveur sait qu'il doit la remonter.
              ...(garage ? [{ bottleSizeId: garage.bottleSizeId, flavor: garage.flavor, quantity: garage.quantity, unitCents: 0, fromGarage: true }] : []),
            ],
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "TAKEN") return { error: "Ce carré vient d'être réservé par quelqu'un d'autre. Choisissez-en un autre." };
    if (e instanceof Error && e.message === "GARAGE") return { error: "Cette bouteille du garage vient d'être reprise." };
    throw e;
  }
  return { token };
}
