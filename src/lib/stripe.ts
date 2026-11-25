import "server-only";
import Stripe from "stripe";

/**
 * Stripe, initialisé à la première utilisation seulement : sans clé, le build et le site
 * fonctionnent toujours, les paiements restent simplement « à venir ».
 */
let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { appInfo: { name: "Tablo" }, maxNetworkRetries: 2 }) : null;
  return client;
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

/** Le club peut-il encaisser en ligne ? Clé Tablo présente et compte du club activé par Stripe. */
export function paymentsReady(venue: { stripeAccountId: string | null; stripeChargesEnabled: boolean }) {
  return stripeConfigured() && !!venue.stripeAccountId && venue.stripeChargesEnabled;
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Temps laissé au client pour payer : son carré est tenu pendant ce temps. Stripe impose 30 min minimum. */
export const HOLD_MINUTES = 31;
export const holdFromNow = () => new Date(Date.now() + HOLD_MINUTES * 60_000);
