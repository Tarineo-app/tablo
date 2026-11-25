"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { callerIp, rateLimit } from "@/lib/ratelimit";

const Input = z.object({
  token: z.string().min(10),
  lines: z.array(z.object({
    bottleSizeId: z.string().nullable(),
    showId: z.string().nullable(),
    flavor: z.string().trim().max(40).nullable(),
    quantity: z.number().int().min(1).max(20),
  })).min(1, "Choisissez au moins un article.").max(20),
});

export type ReorderState = { error?: string; ok?: string } | undefined;

/**
 * Recommander depuis la table, pendant la soirée. L'envoi part directement
 * au service, numéroté à la suite. Les prix sont relus en base.
 */
export async function reorder(raw: z.infer<typeof Input>): Promise<ReorderState> {
  const p = Input.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const tooMany = await rateLimit("recommande", await callerIp(), 20, 10 * 60_000);
  if (tooMany) return { error: tooMany };

  const r = await db.reservation.findUnique({
    where: { qrToken: d.token },
    select: { id: true, venueId: true, status: true, payMode: true, totalCents: true, event: { select: { date: true } }, venue: { select: { slug: true } } },
  });
  if (!r) return { error: "Réservation introuvable." };
  if (r.status === "CANCELLED" || r.status === "NO_SHOW") return { error: "Cette réservation n'est plus active." };
  if (r.status === "PENDING_PAYMENT") return { error: "Réglez d'abord votre réservation : la carte du soir s'ouvre ensuite." };

  // La recommande n'a de sens que la nuit même : de la veille au lendemain midi.
  const start = r.event.date.getTime() - 864e5;
  const end = r.event.date.getTime() + 432e5;
  const t = Date.now();
  if (t < start || t > end) return { error: "La commande en direct ouvre le soir de votre réservation." };

  const sizeIds = d.lines.map((l) => l.bottleSizeId).filter((v): v is string => !!v);
  const showIds = d.lines.map((l) => l.showId).filter((v): v is string => !!v);
  const [sizes, shows] = await Promise.all([
    db.bottleSize.findMany({ where: { id: { in: sizeIds }, bottle: { venueId: r.venueId, active: true } }, select: { id: true, priceCents: true } }),
    db.show.findMany({ where: { id: { in: showIds }, venueId: r.venueId, active: true }, select: { id: true, priceCents: true } }),
  ]);
  const priceOf = new Map<string, number>([...sizes.map((x) => [x.id, x.priceCents] as const), ...shows.map((x) => [x.id, x.priceCents] as const)]);

  const items = d.lines.map((l) => {
    const key = l.bottleSizeId ?? l.showId ?? "";
    const unit = priceOf.get(key);
    if (unit === undefined) return null;
    return { bottleSizeId: l.bottleSizeId, showId: l.showId, flavor: l.flavor, quantity: l.quantity, unitCents: unit };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length !== d.lines.length) return { error: "Un article n'est plus à la carte." };

  const total = items.reduce((a, i) => a + i.unitCents * i.quantity, 0);

  await db.$transaction(async (tx) => {
    const last = await tx.order.findFirst({ where: { reservationId: r.id }, orderBy: { number: "desc" }, select: { number: true } });
    await tx.order.create({
      data: {
        venueId: r.venueId, reservationId: r.id, number: (last?.number ?? 0) + 1,
        // Ce qui est recommandé dans la nuit se règle à table, quel que soit le mode de la réservation.
        cashDueCents: total,
        items: { create: items },
      },
    });
    await tx.reservation.update({ where: { id: r.id }, data: { totalCents: r.totalCents + total } });
  });

  revalidatePath("/app/service");
  revalidatePath("/app");
  revalidatePath(`/w/${r.venue.slug}/r/${d.token}`);
  return { ok: "C'est parti en cuisine. Votre serveur arrive." };
}

const Ask = z.object({ token: z.string().min(10), note: z.string().trim().min(2, "Dites ce que vous voulez.").max(600) });

/** « Demandez à votre manager » : il reçoit la demande et revient avec un prix. */
export async function askManager(raw: z.infer<typeof Ask>): Promise<ReorderState> {
  const p = Ask.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const tooMany = await rateLimit("recommande-ask", await callerIp(), 10, 60 * 60_000);
  if (tooMany) return { error: tooMany };

  const r = await db.reservation.findUnique({
    where: { qrToken: p.data.token },
    select: { id: true, venueId: true, eventId: true, tableId: true, managerId: true, guests: true, organizerName: true, organizerEmail: true, organizerPhone: true },
  });
  if (!r) return { error: "Réservation introuvable." };

  const { offerCode } = await import("@/lib/offers");
  await db.offer.create({
    data: {
      venueId: r.venueId, eventId: r.eventId, tableId: r.tableId, managerId: r.managerId,
      status: "REQUESTED", code: offerCode(), guests: r.guests, askNote: p.data.note,
      clientName: r.organizerName, clientEmail: r.organizerEmail, clientPhone: r.organizerPhone,
    },
  });
  revalidatePath("/app/offres");
  return { ok: "Votre manager a reçu la demande, il revient vers vous." };
}
