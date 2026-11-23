import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";

export const metadata = { title: "Réservations · Tablo" };

const STATUS: Record<string, string> = { DRAFT: "À payer", PENDING_PAYMENT: "Paiement en cours", CONFIRMED: "Acompte payé", FULLY_PAID: "Payée", CHECKED_IN: "Arrivée", COMPLETED: "Terminée", CANCELLED: "Annulée", NO_SHOW: "Absente", PAYMENT_ISSUE: "Problème de paiement" };
const MODE: Record<string, string> = { FULL: "Complet", POOL: "Cagnotte", CASH: "Espèces" };

export default async function Page() {
  const { venue, membership } = await requireMembership(["OWNER", "DIRECTOR", "MANAGER"]);
  const mine = membership.role === "MANAGER";
  const list = await db.reservation.findMany({
    where: { venueId: venue.id, ...(mine ? { managerId: membership.id } : {}) },
    include: { table: { select: { name: true } }, event: { select: { date: true, name: true } }, manager: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <header>
        <h1>{mine ? "Mes réservations" : "Réservations"}</h1>
        <p>Les réservations faites depuis le widget. Le paiement en ligne (acompte, cagnotte) arrive à l&apos;étape suivante du développement : pour l&apos;instant elles sont « à payer ».</p>
      </header>
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="list">
          <thead><tr><th>Soirée</th><th>Carré</th><th>Client</th><th>Pers.</th><th>Total</th><th>Acompte</th><th>Paiement</th><th>Statut</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="mute">Aucune réservation pour l&apos;instant.</td></tr>}
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.event.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })}<br /><span className="mute">{r.event.name}</span></td>
                <td><b>{r.table.name}</b></td>
                <td>{r.organizerName}<br /><span className="mute">{r.organizerPhone}</span>{r.manager && <><br /><span className="tag soft">via {r.manager.user.name}</span></>}</td>
                <td>{r.guests}</td>
                <td><b>{eur(r.totalCents)}</b></td>
                <td>{eur(r.depositCents)}</td>
                <td>{MODE[r.payMode]}</td>
                <td><span className="tag soft">{STATUS[r.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
