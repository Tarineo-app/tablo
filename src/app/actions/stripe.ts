"use server";

import { redirect } from "next/navigation";
import { MANAGE, refuseInDemo, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, stripe } from "@/lib/stripe";

export type StripeState = { error?: string } | undefined;

/** Prix de l'abonnement Club, en centimes. Un prix créé dans Stripe (STRIPE_PRICE_CLUB) a priorité. */
const CLUB_MONTHLY_CENTS = 20000;

/** « Activer les paiements » : on ouvre (ou reprend) l'inscription du club chez Stripe. */
export async function connectPayments(): Promise<StripeState> {
  const { venue, user } = await requireMembership(MANAGE);
  const demo = await refuseInDemo();
  if (demo) return demo;
  const s = stripe();
  if (!s) return { error: "Les paiements ne sont pas encore branchés côté Tablo. Réessayez bientôt." };

  let accountId = venue.stripeAccountId;
  if (!accountId) {
    const acct = await s.accounts.create({
      type: "express",
      country: "FR",
      email: user.email,
      default_currency: "eur",
      business_profile: {
        name: venue.name,
        mcc: "5813", // bars, boîtes de nuit
        ...(venue.websiteUrl ? { url: venue.websiteUrl } : {}),
        product_description: "Réservation de carrés VIP et consommations",
      },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { venueId: venue.id },
    });
    accountId = acct.id;
    // Écriture conditionnelle : deux clics simultanés ne créent pas deux comptes rattachés.
    const saved = await db.venue.updateMany({ where: { id: venue.id, stripeAccountId: null }, data: { stripeAccountId: acct.id } });
    if (saved.count === 0) {
      const v = await db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { stripeAccountId: true } });
      accountId = v.stripeAccountId!;
    }
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/app/paiements?relance=1`,
    return_url: `${appUrl()}/app/paiements?retour=1`,
  });
  redirect(link.url);
}

/** Le tableau de bord Stripe du club : virements, remboursements, relevés. */
export async function openStripeDashboard(): Promise<StripeState> {
  const { venue } = await requireMembership(MANAGE);
  const demo = await refuseInDemo();
  if (demo) return demo;
  const s = stripe();
  if (!s || !venue.stripeAccountId) return { error: "Activez d'abord les paiements." };
  const login = await s.accounts.createLoginLink(venue.stripeAccountId);
  redirect(login.url);
}

/** Abonnement Club : page de paiement Stripe, 200 € par mois, sans engagement. */
export async function startSubscription(): Promise<StripeState> {
  const { venue, user } = await requireMembership(MANAGE);
  const demo = await refuseInDemo();
  if (demo) return demo;
  const s = stripe();
  if (!s) return { error: "Le paiement de l'abonnement n'est pas encore branché. Réessayez bientôt." };
  if (venue.subscriptionStatus && ["active", "trialing", "past_due"].includes(venue.subscriptionStatus)) {
    return { error: "Vous êtes déjà abonné. Gérez votre abonnement depuis le bouton ci-dessous." };
  }

  let customer = venue.stripeCustomerId;
  if (!customer) {
    const c = await s.customers.create({ email: user.email, name: venue.name, metadata: { venueId: venue.id } });
    const saved = await db.venue.updateMany({ where: { id: venue.id, stripeCustomerId: null }, data: { stripeCustomerId: c.id } });
    customer = saved.count ? c.id : (await db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { stripeCustomerId: true } })).stripeCustomerId!;
  }
  const price = process.env.STRIPE_PRICE_CLUB;
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    locale: "fr",
    customer,
    line_items: [
      price
        ? { price, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: CLUB_MONTHLY_CENTS,
              recurring: { interval: "month" },
              product_data: { name: "Tablo Club", description: "Réservation de carrés VIP, offres des managers, app serveur. Zéro commission." },
            },
          },
    ],
    subscription_data: { metadata: { venueId: venue.id } },
    metadata: { kind: "subscription", venueId: venue.id },
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    success_url: `${appUrl()}/app/abonnement?ok=1`,
    cancel_url: `${appUrl()}/app/abonnement`,
  });
  if (!session.url) return { error: "La page de paiement n'a pas pu s'ouvrir." };
  redirect(session.url);
}

/** Factures, carte, résiliation : le portail client de Stripe. */
export async function openBillingPortal(): Promise<StripeState> {
  const { venue } = await requireMembership(MANAGE);
  const demo = await refuseInDemo();
  if (demo) return demo;
  const s = stripe();
  if (!s || !venue.stripeCustomerId) return { error: "Aucun abonnement à gérer pour le moment." };
  const portal = await s.billingPortal.sessions.create({ customer: venue.stripeCustomerId, return_url: `${appUrl()}/app/abonnement`, locale: "fr" });
  redirect(portal.url);
}
