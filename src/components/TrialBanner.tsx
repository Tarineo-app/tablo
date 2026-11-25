import Link from "next/link";

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const day = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

type Report = { tables: number; guests: number; engagedCents: number; entries: number; entriesCents: number };

export default function TrialBanner({
  billing, trialEvent, upcoming, report,
}: {
  billing: "SETUP" | "TRIAL" | "ACTIVE" | "LOCKED";
  trialEvent: { id: string; name: string | null; date: Date } | null;
  upcoming: { id: string; name: string | null; date: Date }[];
  report: Report | null;
}) {
  if (billing === "ACTIVE") return null;

  if (billing === "SETUP") {
    // Plus de soirée offerte : le club configure tout, puis met en ligne (abonnement, satisfait ou remboursé).
    return (
      <section className="card trial">
        <div>
          <span className="tag soft">Pas encore en ligne</span>
          <h2>Terminez la configuration, puis ouvrez vos réservations.</h2>
          <p className="mute">Ambiance, carrés et prix, bouteilles, shows, première soirée : on vous guide étape par étape. Vous mettez en ligne quand tout est prêt, satisfait ou remboursé 30 jours.</p>
        </div>
        <Link href="/app/configuration" className="btn btn-main">Reprendre la configuration</Link>
      </section>
    );
  }

  if (billing === "TRIAL" && trialEvent) {
    return (
      <section className="card trial on">
        <div>
          <span className="tag">Soirée d&apos;essai</span>
          <h2 style={{ textTransform: "capitalize" }}>{trialEvent.name ? `${trialEvent.name} · ` : ""}{day(trialEvent.date)}</h2>
          <p className="mute">Vos réservations sont ouvertes pour cette nuit-là. Collez votre code sur votre site et partagez le lien : tout ce qui rentre est à vous.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card trial end">
      <div>
        <span className="tag">Votre essai</span>
        <h2>{trialEvent?.name ? `${trialEvent.name}, c'est fait.` : "Votre soirée d'essai est passée."}</h2>
        {report && (
          <div className="trialnums">
            <div><b>{report.tables}</b><span>carré(s) réservé(s)</span></div>
            <div><b>{report.guests}</b><span>personnes attendues</span></div>
            <div><b>{eur(report.engagedCents)}</b><span>engagés sur les carrés</span></div>
            <div><b>{report.entries}</b><span>entrée(s) vendue(s)</span></div>
          </div>
        )}
        <p className="mute">Pour ouvrir les soirées suivantes, choisissez votre formule. Vos carrés, votre carte et vos clients sont gardés tels quels.</p>
      </div>
      <Link href="/app/abonnement" className="btn btn-main">Ouvrir les prochaines soirées</Link>
    </section>
  );
}
