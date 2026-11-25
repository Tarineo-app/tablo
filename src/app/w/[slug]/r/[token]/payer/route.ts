import { NextResponse } from "next/server";
import { openReservationCheckout } from "@/lib/checkout";
import { callerIp, rateLimit } from "@/lib/ratelimit";
import { appUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; token: string }> };

/** Le client clique sur « Payer » : on l'envoie sur la page de paiement Stripe du club. */
export async function POST(_req: Request, { params }: Ctx) {
  const { slug, token } = await params;
  const back = `${appUrl()}/w/${encodeURIComponent(slug)}/r/${encodeURIComponent(token)}`;
  const tooMany = await rateLimit("payer", await callerIp(), 20, 10 * 60_000);
  if (tooMany) return NextResponse.redirect(`${back}?paiement=patience`, 303);
  const out = await openReservationCheckout(token, slug);
  if ("url" in out) return NextResponse.redirect(out.url, 303);
  return NextResponse.redirect(`${back}?paiement=${out.error}`, 303);
}
