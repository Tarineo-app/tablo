import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { trialReport } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";
import { syncSubscription } from "@/lib/stripe-sync";
import { openBillingPortal, startSubscription } from "@/app/actions/stripe";
import StripeButton from "@/components/StripeButton";

export const metadata = { title: "Abonnement · Tablo" };

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const PLANS = [
  {
    name: "Club", price: "200 € / mois", sub: "Un établissement, tout l'outil.",
    lines: [
      "Réservation de carrés sur votre site",
      "Offres de vos managers et commissions",
      "Plan de salle en 3D et photos des carrés",
      "Garage, shows et couronnes",
      "App serveur et contrôle à l'entrée",
      "Fichier clients et statistiques",
      "Zéro commission sur vos réservations",
    ],
  },
  {
    name: "Sur mesure", price: "Nous en parlons", sub: "Plusieurs salles, gros volume, besoins à part.",
    lines: [
      "Tout le Club",
      "Plusieurs établissements",
      "Billetterie ouverte si vous la voulez",
      "Exports et connexions à vos outils",
      "Accompagnement à la mise en route",
      "Zéro commission sur vos réservations",
    ],
  },
];

type Props = { searchParams: Promise<{ ok?: string }> };

export default async function Page({ searchParams }: Props) {
  const { venue } = await requireMembership(MANAGE);
  const { ok } = await searchParams;
  // Retour de la page de paiement : on relit Stripe tout de suite, sans attendre le webhook.
  if (ok && venue.stripeCustomerId) await syncSubscription(venue.id, venue.stripeCustomerId);
  const v = await db.venue.findUniqueOrThrow({
    where: { id: venue.id },
    select: { billing: true, trialEventId: true, subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeCustomerId: true },
  });
  const subscribed = !!v.subscriptionStatus && ["active", "trialing", "past_due"].includes(v.subscriptionStatus);
  const until = v.currentPeriodEnd?.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const contact = process.env.CONTACT_EMAIL;
  const report = v.trialEventId ? await trialReport(venue.id, v.trialEventId) : null;

  return (
    <>
      <header>
        <h1>{subscribed ? "Votre abonnement" : "Ouvrir les prochaines soirées"}</h1>
        <p>Pas de commission, jamais. Ce que vos clients dépensent est à vous. Vous payez l&apos;outil, pas vos propres réservations.</p>
      </header>

      {subscribed && (
        <section className="card" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Club · 200 € / mois</h2>
            <span className={`pill ${v.subscriptionStatus === "past_due" ? "sent" : "accepted"}`}>{v.subscriptionStatus === "past_due" ? "Paiement en retard" : v.cancelAtPeriodEnd ? "Résiliation prévue" : "Actif"}</span>
          </div>
          <p style={{ margin: 0 }}>
            {v.subscriptionStatus === "past_due"
              ? "Le dernier prélèvement n'est pas passé. Mettez à jour votre carte pour garder vos soirées ouvertes."
              : v.cancelAtPeriodEnd
                ? `Vos soirées restent ouvertes jusqu'au ${until}. Vous pouvez reprendre l'abonnement à tout moment avant cette date.`
                : `Toutes vos soirées sont ouvertes. Prochain prélèvement le ${until}.`}
          </p>
          <StripeButton action={openBillingPortal} label="Factures, carte et résiliation" main={false} />
        </section>
      )}

      {ok && !subscribed && <section className="card" style={{ marginBottom: 16 }}><b>Merci ! Stripe confirme votre paiement.</b> <span className="mute">Cette page se met à jour dans quelques secondes.</span><meta httpEquiv="refresh" content="4" /></section>}

      {report && report.tables + report.entries > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>Ce que votre soirée d&apos;essai a rapporté</h2>
          <div className="trialnums">
            <div><b>{report.tables}</b><span>carré(s) réservé(s)</span></div>
            <div><b>{report.guests}</b><span>personnes attendues</span></div>
            <div><b>{eur(report.engagedCents)}</b><span>engagés sur les carrés</span></div>
            <div><b>{eur(report.entriesCents)}</b><span>d&apos;entrées vendues</span></div>
          </div>
          <p className="mute" style={{ margin: 0 }}>Une seule nuit, sans rien payer. Les suivantes se règlent ci-dessous.</p>
        </section>
      )}

      <div className="grid2">
        {PLANS.map((p) => (
          <section key={p.name} className="card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>{p.name}</h2>
            <b style={{ fontSize: 26, letterSpacing: "-.02em" }}>{p.price}</b>
            <p className="mute" style={{ margin: 0 }}>{p.sub}</p>
            <ul style={{ display: "grid", gap: 6, margin: "6px 0 0", padding: 0, listStyle: "none", lineHeight: 1.5 }}>
              {p.lines.map((l) => <li key={l}>· {l}</li>)}
            </ul>
            <div style={{ marginTop: 8 }}>
              {p.name === "Club" ? (
                subscribed ? <span className="pill accepted">Votre formule</span> : <StripeButton action={startSubscription} label="S'abonner · 200 € / mois" disabled={!stripeConfigured()} />
              ) : contact ? (
                <a className="btn" href={`mailto:${contact}?subject=${encodeURIComponent(`Tablo sur mesure · ${venue.name}`)}`}>Nous écrire</a>
              ) : (
                <span className="mute">Parlons-en : répondez simplement à l&apos;email de bienvenue.</span>
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="mute" style={{ marginTop: 14, fontSize: 13.5 }}>
        {stripeConfigured()
          ? "Sans engagement : vous résiliez quand vous voulez, vos soirées restent ouvertes jusqu'à la fin du mois payé. Facture envoyée chaque mois."
          : "Le paiement par carte s'ouvre dans quelques jours. En attendant, vos données restent intactes : vos carrés, votre carte, vos clients et vos soirées passées vous attendent."}
      </p>
    </>
  );
}
