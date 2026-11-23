import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { trialReport } from "@/lib/billing";

export const metadata = { title: "Abonnement · Tablo" };

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const PLANS = [
  {
    name: "Club", price: "79 € / mois", sub: "Pour un établissement, une salle.",
    lines: ["Réservation de carrés sur votre site", "Billetterie et QR codes à l'entrée", "Plan de salle en 3D", "Garage et shows", "Équipe et commissions", "Zéro commission sur vos réservations"],
  },
  {
    name: "Prestige", price: "149 € / mois", sub: "Plusieurs salles, ou un gros volume.",
    lines: ["Tout le Club", "Plusieurs établissements", "Fichier clients et exports", "Cagnotte entre amis", "Revente et transfert de billets", "Zéro commission sur vos réservations"],
  },
];

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const v = await db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { billing: true, trialEventId: true } });
  const report = v.trialEventId ? await trialReport(venue.id, v.trialEventId) : null;

  return (
    <>
      <header>
        <h1>Ouvrir les prochaines soirées</h1>
        <p>Pas de commission, jamais. Ce que vos clients dépensent est à vous. Vous payez l&apos;outil, pas vos propres réservations.</p>
      </header>

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
            <button className="btn btn-main" disabled style={{ marginTop: 8 }}>Payer par carte</button>
          </section>
        ))}
      </div>
      <p className="mute" style={{ marginTop: 14, fontSize: 13.5 }}>
        Le paiement par carte s&apos;ouvre dans quelques jours. En attendant, vos données restent intactes : vos carrés, votre carte, vos clients et vos soirées passées vous attendent.
      </p>
    </>
  );
}
