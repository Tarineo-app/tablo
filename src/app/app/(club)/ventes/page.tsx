import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";

export const metadata = { title: "Ventes · Tablo" };

const STATUS: Record<string, string> = { DRAFT: "À payer", PENDING_PAYMENT: "Paiement en cours", CONFIRMED: "Acompte payé", FULLY_PAID: "Payée", CHECKED_IN: "Arrivée", COMPLETED: "Terminée", CANCELLED: "Annulée", NO_SHOW: "Absente", PAYMENT_ISSUE: "Problème de paiement" };
const TSTATUS: Record<string, string> = { PENDING: "À payer", PAID: "Payé", CHECKED_IN: "Entré", CANCELLED: "Annulé" };
const MODE: Record<string, string> = { FULL: "Complet", POOL: "Cagnotte", CASH: "Espèces" };
const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const billets = type === "billets";
  const { venue, membership } = await requireMembership(["OWNER", "DIRECTOR", "MANAGER"]);
  const mine = membership.role === "MANAGER";
  const only = mine ? { managerId: membership.id } : {};

  const [resas, tickets] = await Promise.all([
    db.reservation.findMany({
      where: { venueId: venue.id, ...only },
      include: { table: { select: { name: true } }, event: { select: { date: true, name: true } }, manager: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" }, take: 200,
    }),
    db.ticket.findMany({
      where: { venueId: venue.id, ...only },
      include: { tier: true, event: { select: { date: true, name: true } }, manager: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" }, take: 200,
    }),
  ]);

  const caResa = resas.filter((r) => r.status !== "CANCELLED").reduce((a, r) => a + r.totalCents, 0);
  const caBillets = tickets.filter((t) => t.status !== "CANCELLED").reduce((a, t) => a + t.totalCents, 0);

  return (
    <>
      <header>
        <h1>{mine ? "Mes ventes" : "Ventes"}</h1>
        <p>Les carrés réservés et les entrées vendues depuis le widget. Le paiement en ligne arrive à l&apos;étape suivante : pour l&apos;instant, les commandes restent « à payer ».</p>
      </header>

      <div className="grid3" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Carrés</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{resas.length}</div><span className="mute" style={{ fontSize: 12 }}>{eur(caResa)}</span></div>
        <div className="card"><span className="mute">Entrées</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{tickets.reduce((a, t) => a + t.quantity, 0)}</div><span className="mute" style={{ fontSize: 12 }}>{eur(caBillets)}</span></div>
        <div className="card"><span className="mute">Total</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }} className="holo">{eur(caResa + caBillets)}</div></div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <Link className={`btn ${billets ? "btn-out" : "btn-main"}`} href="/app/ventes">Carrés</Link>
        <Link className={`btn ${billets ? "btn-main" : "btn-out"}`} href="/app/ventes?type=billets">Entrées</Link>
      </div>

      <section className="card" style={{ overflowX: "auto" }}>
        {billets ? (
          <table className="list">
            <thead><tr><th>Soirée</th><th>Client</th><th>Tarif</th><th>Entrées</th><th>Montant</th><th>Code</th><th>Statut</th></tr></thead>
            <tbody>
              {tickets.length === 0 && <tr><td colSpan={7} className="mute">Aucune entrée vendue pour l&apos;instant.</td></tr>}
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{jour(t.event.date)}<br /><span className="mute">{t.event.name}</span></td>
                  <td>{t.buyerName}<br /><span className="mute">{t.buyerEmail}</span>{t.manager && <><br /><span className="tag soft">via {t.manager.user.name}</span></>}</td>
                  <td>{t.tier.name}</td>
                  <td>{t.checkedIn ? `${t.checkedIn} / ${t.quantity}` : t.quantity}</td>
                  <td><b>{eur(t.totalCents)}</b></td>
                  <td style={{ fontFamily: "monospace" }}>{t.qrToken}</td>
                  <td><span className="tag soft">{TSTATUS[t.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="list">
            <thead><tr><th>Soirée</th><th>Carré</th><th>Client</th><th>Pers.</th><th>Total</th><th>Acompte</th><th>Paiement</th><th>Statut</th></tr></thead>
            <tbody>
              {resas.length === 0 && <tr><td colSpan={8} className="mute">Aucune réservation pour l&apos;instant.</td></tr>}
              {resas.map((r) => (
                <tr key={r.id}>
                  <td>{jour(r.event.date)}<br /><span className="mute">{r.event.name}</span></td>
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
        )}
      </section>
    </>
  );
}
