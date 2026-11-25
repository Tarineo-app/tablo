import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";
import { refreshPayments } from "@/lib/stripe-sync";
import { connectPayments, openStripeDashboard } from "@/app/actions/stripe";
import StripeButton from "@/components/StripeButton";

export const metadata = { title: "Paiements · Tablo" };

type Props = { searchParams: Promise<{ retour?: string; relance?: string }> };

export default async function Page({ searchParams }: Props) {
  const { venue } = await requireMembership(MANAGE);
  const { retour, relance } = await searchParams;
  // Au retour de Stripe, on relit l'état du compte tout de suite.
  if ((retour || relance) && venue.stripeAccountId) await refreshPayments(venue.id, venue.stripeAccountId);
  const v = await db.venue.findUniqueOrThrow({
    where: { id: venue.id },
    select: { stripeAccountId: true, stripeChargesEnabled: true, stripeDetailsSubmitted: true },
  });
  const ready = v.stripeChargesEnabled;
  const started = !!v.stripeAccountId;

  return (
    <>
      <header>
        <h1>Paiements</h1>
        <p>L&apos;argent de vos clients arrive directement sur votre compte, par Stripe. Tablo ne prend aucune commission ; seuls les frais bancaires de Stripe s&apos;appliquent, comme pour un terminal.</p>
      </header>

      {!stripeConfigured() && (
        <section className="card" style={{ marginBottom: 16 }}>
          <b>Le paiement en ligne arrive très bientôt.</b>
          <p className="mute" style={{ margin: "6px 0 0" }}>En attendant, vos réservations restent « à payer » et vous encaissez au club comme d&apos;habitude.</p>
        </section>
      )}

      <section className="card" style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Votre compte de paiement</h2>
          <span className={`pill ${ready ? "accepted" : started ? "sent" : ""}`}>{ready ? "Actif" : started ? "À terminer" : "Pas encore activé"}</span>
        </div>
        {ready ? (
          <>
            <p style={{ margin: 0 }}>Vos clients paient leur acompte ou leur réservation en ligne : carte, Apple Pay, Google Pay. Les virements arrivent sur votre compte bancaire.</p>
            <StripeButton action={openStripeDashboard} label="Voir mes virements chez Stripe" main={false} />
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              {started
                ? "Stripe attend encore quelques informations (identité, IBAN). Reprenez là où vous vous êtes arrêté."
                : "Cinq minutes : votre société, votre identité et l'IBAN où verser l'argent. Stripe vérifie, puis vos clients peuvent payer en ligne."}
            </p>
            <StripeButton action={connectPayments} label={started ? "Terminer l'activation" : "Activer les paiements"} disabled={!stripeConfigured()} />
            {retour && !ready && v.stripeDetailsSubmitted && <p className="mute" style={{ margin: 0 }}>Merci, Stripe vérifie vos informations. Cela prend en général quelques minutes.</p>}
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16, display: "grid", gap: 6 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Comment ça se passe pour vos clients</h2>
        <p className="mute" style={{ margin: 0 }}>
          Le client choisit son carré et paie l&apos;acompte prévu par la catégorie (ou tout, s&apos;il le souhaite) sur une page sécurisée. Son carré est tenu 30 minutes pendant le paiement.
          Dès que Stripe confirme, la réservation passe en « confirmée », il reçoit son QR code par email, et le reste se règle au club.
        </p>
      </section>
    </>
  );
}
