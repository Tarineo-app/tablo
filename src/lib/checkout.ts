import "server-only";
import { db } from "./db";
import { gateFor } from "./billing";
import { occupying } from "./holds";
import { appUrl, holdFromNow, paymentsReady, stripe } from "./stripe";

export type PayOutcome = { url: string } | { error: "indisponible" | "deja" | "annulee" | "rien" | "pris" | "fermee" | "stripe" };

const PAID = ["CONFIRMED", "FULLY_PAID", "CHECKED_IN", "COMPLETED"] as const;

/**
 * Ouvre (ou rouvre) le paiement d'une réservation sur la page sécurisée de Stripe.
 * Le paiement est fait directement sur le compte Stripe du club : Tablo ne prend rien dessus.
 * Le carré est tenu pendant 30 minutes ; si le délai est passé, on le reprend seulement s'il est encore libre.
 */
export async function openReservationCheckout(token: string, slug: string): Promise<PayOutcome> {
  const s = stripe();
  const r = await db.reservation.findUnique({
    where: { qrToken: token },
    include: { venue: true, event: true, table: { include: { category: true } } },
  });
  if (!r || r.venue.slug !== slug) return { error: "annulee" };
  if (!s || !paymentsReady(r.venue) || !r.venue.stripeAccountId) return { error: "indisponible" };
  if ((PAID as readonly string[]).includes(r.status)) return { error: "deja" };
  if (r.status === "CANCELLED" || r.status === "NO_SHOW") return { error: "annulee" };
  if (r.depositCents <= 0) return { error: "rien" };
  if (r.event.date.getTime() < Date.now() - 12 * 3600e3 || !gateFor(r.venue, r.eventId).open) return { error: "fermee" };
  const ctx = { stripeContext: r.venue.stripeAccountId };

  // Une page de paiement encore ouverte et un carré encore tenu : on y renvoie le client.
  if (r.stripeSessionId) {
    try {
      const old = await s.checkout.sessions.retrieve(r.stripeSessionId, {}, ctx);
      if (old.status === "complete") return { error: "deja" };
      if (old.status === "open" && old.url && r.holdUntil && r.holdUntil.getTime() > Date.now() + 2 * 60_000) return { url: old.url };
    } catch {
      /* session introuvable : on en ouvre une autre */
    }
  }

  // Le carré doit être libre de toute autre réservation active.
  const other = await db.reservation.count({ where: { eventId: r.eventId, tableId: r.tableId, id: { not: r.id }, ...occupying(["NO_SHOW"]) } });
  if (other) {
    await db.reservation.updateMany({ where: { id: r.id, status: { in: ["DRAFT", "PENDING_PAYMENT"] } }, data: { status: "CANCELLED" } });
    return { error: "pris" };
  }

  const hold = holdFromNow();
  const date = r.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const what = r.payMode === "FULL" || r.depositCents >= r.totalCents ? "Réservation" : "Acompte";
  const back = `${appUrl()}/w/${slug}/r/${token}`;
  const meta = { kind: "reservation", reservationId: r.id, venueId: r.venueId };
  try {
    const session = await s.checkout.sessions.create(
      {
        mode: "payment",
        locale: "fr",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: r.depositCents,
            product_data: { name: `${what} · carré ${r.table.name}`, description: `${r.venue.name} · ${date} · ${r.guests} personnes` },
          },
        }],
        customer_email: r.organizerEmail || undefined,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: meta,
        payment_intent_data: { metadata: meta, description: `${r.venue.name} · ${what.toLowerCase()} carré ${r.table.name} · ${date}` },
        success_url: `${back}?paiement=ok`,
        cancel_url: `${back}?paiement=annule`,
      },
      ctx,
    );
    await db.reservation.update({ where: { id: r.id }, data: { status: "PENDING_PAYMENT", holdUntil: hold, stripeSessionId: session.id } });
    if (!session.url) return { error: "stripe" };
    return { url: session.url };
  } catch (e) {
    console.error("[stripe] ouverture du paiement impossible", e instanceof Error ? e.message : e);
    return { error: "stripe" };
  }
}
