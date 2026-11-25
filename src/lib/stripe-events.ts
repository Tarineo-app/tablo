import "server-only";
import type Stripe from "stripe";
import { db } from "./db";
import { occupying } from "./holds";
import { stripe } from "./stripe";
import { sendReservationConfirmed, sendReservationRefunded } from "./notify";

const PAID = ["CONFIRMED", "FULLY_PAID", "CHECKED_IN", "COMPLETED"];
const piOf = (s: Stripe.Checkout.Session) => (typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id) ?? null;

async function refund(pi: string | null, account: string) {
  if (!pi) return;
  try {
    await stripe()?.refunds.create({ payment_intent: pi, reason: "duplicate" }, { stripeContext: account });
  } catch (e) {
    console.error("[stripe] remboursement impossible", pi, e instanceof Error ? e.message : e);
  }
}

/** Remet au garage la bouteille qu'une réservation abandonnée avait réservée. */
async function releaseGarage(reservationId: string, garageItemId: string | null) {
  if (!garageItemId) return;
  await db.garageItem.updateMany({ where: { id: garageItemId, status: "RETRIEVED" }, data: { status: "STORED", retrievedAt: null } });
  await db.reservation.update({ where: { id: reservationId }, data: { garageItemId: null } });
}

/** Paiement d'une réservation reçu sur le compte du club. */
export async function onReservationPaid(session: Stripe.Checkout.Session, account: string | undefined) {
  const id = session.metadata?.reservationId;
  if (!id || session.payment_status !== "paid") return "ignored";
  const r = await db.reservation.findUnique({ where: { id }, include: { venue: { select: { stripeAccountId: true } } } });
  if (!r) return "unknown";
  // L'événement doit venir du compte Stripe de ce club, et de personne d'autre.
  if (!account || r.venue.stripeAccountId !== account) {
    console.error("[stripe] compte inattendu pour la réservation", id, account);
    return "wrong-account";
  }
  const pi = piOf(session);
  const amount = session.amount_total ?? 0;

  if (PAID.includes(r.status)) {
    // Déjà confirmée. Même paiement : rien à faire (Stripe renvoie parfois deux fois). Autre paiement : doublon, on rembourse.
    if (r.stripePaymentIntentId && pi && r.stripePaymentIntentId !== pi) {
      await refund(pi, account);
      return "duplicate-refunded";
    }
    return "already";
  }

  // Le carré est-il toujours à lui ? (le délai a pu passer et quelqu'un d'autre le prendre)
  const outcome = await db.$transaction(async (tx) => {
    const other = await tx.reservation.count({ where: { eventId: r.eventId, tableId: r.tableId, id: { not: r.id }, ...occupying(["NO_SHOW"]) } });
    if (other) {
      await tx.reservation.update({ where: { id: r.id }, data: { status: "CANCELLED", stripePaymentIntentId: pi, holdUntil: null } });
      return "taken" as const;
    }
    await tx.reservation.update({
      where: { id: r.id },
      data: {
        status: amount >= r.totalCents ? "FULLY_PAID" : "CONFIRMED",
        paidCents: amount,
        paidAt: new Date(),
        stripePaymentIntentId: pi,
        stripeSessionId: session.id,
        holdUntil: null,
      },
    });
    return "confirmed" as const;
  });

  if (outcome === "taken") {
    await refund(pi, account);
    await releaseGarage(r.id, r.garageItemId);
    await sendReservationRefunded(r.id);
    return "taken-refunded";
  }
  await sendReservationConfirmed(r.id);
  return "confirmed";
}

/** Page de paiement expirée ou paiement refusé : le carré repart à la vente. */
export async function onReservationAbandoned(session: Stripe.Checkout.Session) {
  const id = session.metadata?.reservationId;
  if (!id) return "ignored";
  const r = await db.reservation.findUnique({ where: { id }, select: { id: true, status: true, stripeSessionId: true, garageItemId: true } });
  // On n'annule que si c'est bien la dernière page de paiement ouverte pour cette réservation.
  if (!r || r.status !== "PENDING_PAYMENT" || r.stripeSessionId !== session.id) return "ignored";
  const done = await db.reservation.updateMany({ where: { id: r.id, status: "PENDING_PAYMENT", stripeSessionId: session.id }, data: { status: "CANCELLED", holdUntil: null } });
  if (done.count) await releaseGarage(r.id, r.garageItemId);
  return "cancelled";
}

/** Le compte Stripe d'un club change d'état (activation, informations manquantes…). */
export async function onAccountUpdated(acct: Stripe.Account) {
  await db.venue.updateMany({
    where: { stripeAccountId: acct.id },
    data: { stripeChargesEnabled: !!acct.charges_enabled, stripeDetailsSubmitted: !!acct.details_submitted },
  });
  return "account";
}

/** Abonnement du club à Tablo : Stripe est la source de vérité. */
export async function onSubscription(sub: Stripe.Subscription) {
  const venueId = sub.metadata?.venueId;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const venue = await db.venue.findFirst({
    where: { OR: [{ stripeSubscriptionId: sub.id }, ...(venueId ? [{ id: venueId, stripeCustomerId: customer }] : [])] },
    select: { id: true, billing: true },
  });
  if (!venue) return "unknown";
  const end = sub.items.data[0]?.current_period_end;
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  await db.venue.update({
    where: { id: venue.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customer,
      subscriptionStatus: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: end ? new Date(end * 1000) : null,
      // Abonné : tout est ouvert. Abonnement terminé : on referme. Sinon, on ne touche à rien.
      ...(live ? { billing: "ACTIVE" as const } : ["canceled", "unpaid", "incomplete_expired"].includes(sub.status) ? { billing: "LOCKED" as const } : {}),
    },
  });
  return live ? "subscribed" : sub.status;
}

/** Paiement de l'abonnement terminé sur la page Stripe : on rattache l'abonnement au club tout de suite. */
export async function onSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const venueId = session.metadata?.venueId;
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!venueId || !subId) return "ignored";
  const s = stripe();
  if (!s) return "no-stripe";
  const sub = await s.subscriptions.retrieve(subId);
  // Le club doit correspondre au client Stripe de la session.
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const venue = await db.venue.findUnique({ where: { id: venueId }, select: { stripeCustomerId: true } });
  if (!venue || (venue.stripeCustomerId && customer && venue.stripeCustomerId !== customer)) return "wrong-customer";
  await db.venue.update({ where: { id: venueId }, data: { stripeSubscriptionId: sub.id, stripeCustomerId: customer ?? venue.stripeCustomerId } });
  return onSubscription(sub);
}

/** Aiguillage d'un événement Stripe déjà vérifié. */
export async function handleStripeEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.mode === "subscription" || s.metadata?.kind === "subscription") return event.account ? "ignored" : onSubscriptionCheckout(s);
      if (s.metadata?.kind === "reservation") return onReservationPaid(s, event.account);
      return "ignored";
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      return s.metadata?.kind === "reservation" ? onReservationAbandoned(s) : "ignored";
    }
    case "account.updated":
      return onAccountUpdated(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // Les abonnements Tablo vivent sur le compte de la plateforme, jamais sur celui d'un club.
      return event.account ? "ignored" : onSubscription(event.data.object);
    default:
      return "ignored";
  }
}
