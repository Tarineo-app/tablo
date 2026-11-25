import "server-only";
import { revalidatePath } from "next/cache";
import { stripe } from "./stripe";
import { onAccountUpdated, onSubscription } from "./stripe-events";

// Lectures directes chez Stripe, appelées par nos pages (jamais exposées comme actions au navigateur).

/** Relit l'état du compte chez Stripe (au retour de l'inscription, sans attendre le webhook). */
export async function refreshPayments(venueId: string, accountId: string) {
  const s = stripe();
  if (!s) return;
  try {
    const acct = await s.accounts.retrieve(accountId);
    if (acct.metadata?.venueId && acct.metadata.venueId !== venueId) return;
    await onAccountUpdated(acct);
  } catch (e) {
    console.error("[stripe] lecture du compte impossible", e instanceof Error ? e.message : e);
  }
}

/** Au retour du paiement de l'abonnement : on relit Stripe tout de suite, sans attendre le webhook. */
export async function syncSubscription(venueId: string, customerId: string) {
  const s = stripe();
  if (!s) return;
  try {
    const subs = await s.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    const sub = subs.data[0];
    if (sub && (sub.metadata?.venueId ?? venueId) === venueId) await onSubscription(sub);
    revalidatePath("/app");
  } catch (e) {
    console.error("[stripe] lecture de l'abonnement impossible", e instanceof Error ? e.message : e);
  }
}
