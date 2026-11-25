import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe nous prévient ici. Deux points d'écoute dans le tableau de bord Stripe, deux secrets :
 *  - « Votre compte » (abonnements Tablo)            → STRIPE_WEBHOOK_SECRET
 *  - « Comptes connectés » (paiements des clubs)     → STRIPE_CONNECT_WEBHOOK_SECRET
 * Rien n'est cru sans signature valide : c'est la seule source de vérité des paiements.
 */
export async function POST(req: Request) {
  const s = stripe();
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((x): x is string => !!x);
  if (!s || secrets.length === 0) return NextResponse.json({ error: "Stripe n'est pas configuré." }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  const body = await req.text();

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = s.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      /* on essaie le secret suivant */
    }
  }
  if (!event) return NextResponse.json({ error: "Signature invalide." }, { status: 400 });

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (e) {
    // 500 : Stripe renverra l'événement plus tard, rien n'est perdu.
    console.error("[stripe] traitement impossible", event.type, event.id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }
}
