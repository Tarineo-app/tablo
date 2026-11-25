import "server-only";
import Stripe from "stripe";

/**
 * Stripe, initialisé à la première utilisation seulement : sans clé, le build et le site
 * fonctionnent toujours, les paiements restent simplement « à venir ».
 */
let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  client = key ? new Stripe(key, { appInfo: { name: "Tablo" }, maxNetworkRetries: 2 }) : null;
  return client;
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY?.trim();

/** Le club peut-il encaisser en ligne ? Clé Tablo présente et compte du club activé par Stripe. */
export function paymentsReady(venue: { stripeAccountId: string | null; stripeChargesEnabled: boolean }) {
  return stripeConfigured() && !!venue.stripeAccountId && venue.stripeChargesEnabled;
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Temps pendant lequel le carré est tenu le temps que le client paie :
 * 5 min quand il réserve seul, 30 min quand il accepte l'offre d'un manager.
 * (La page Stripe, elle, reste ouverte 30 min, le minimum imposé par Stripe : si le client paie après
 * que son carré a été repris par quelqu'un d'autre, le webhook le rembourse automatiquement.)
 */
export const HOLD_MINUTES = { direct: 5, offer: 30 } as const;
export const holdFromNow = (kind: keyof typeof HOLD_MINUTES = "direct") => new Date(Date.now() + HOLD_MINUTES[kind] * 60_000);
