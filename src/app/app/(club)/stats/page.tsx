import { MANAGE, requireMembership } from "@/lib/auth";
import { now, tomorrow } from "@/lib/dates";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";

export const metadata = { title: "Statistiques · Tablo" };

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);

  const [events, tables, team] = await Promise.all([
    db.event.findMany({
      where: { venueId: venue.id, date: { lte: tomorrow() } },
      orderBy: { date: "desc" }, take: 12,
      include: {
        reservations: { select: { totalCents: true, guests: true, status: true, managerId: true, createdAt: true } },
        tickets: { where: { status: { not: "CANCELLED" } }, select: { quantity: true, totalCents: true, tierId: true } },
        ticketTiers: { select: { id: true, name: true } },
      },
    }),
    db.venueTable.count({ where: { venueId: venue.id, active: true } }),
    db.membership.findMany({ where: { venueId: venue.id, role: "MANAGER" }, include: { user: { select: { name: true } } } }),
  ]);

  const maintenant = now().getTime();
  const soirees = events.map((e) => {
    const live = e.reservations.filter((r) => r.status !== "CANCELLED");
    const caTables = live.reduce((a, r) => a + r.totalCents, 0);
    const caTickets = e.tickets.reduce((a, t) => a + t.totalCents, 0);
    const delais = live.map((r) => Math.max(0, Math.round((e.date.getTime() - r.createdAt.getTime()) / 864e5)));
    return {
      id: e.id, date: e.date, name: e.name,
      carres: live.length,
      remplissage: pct(live.length, tables),
      panier: live.length ? Math.round(caTables / live.length) : 0,
      entrees: e.tickets.reduce((a, t) => a + t.quantity, 0),
      ca: caTables + caTickets,
      caTables, caTickets,
      absents: e.reservations.filter((r) => r.status === "NO_SHOW").length,
      viaManager: live.filter((r) => r.managerId).length,
      delaiMoyen: delais.length ? Math.round(delais.reduce((a, d) => a + d, 0) / delais.length) : 0,
      tiers: e.ticketTiers.map((t) => ({ name: t.name, q: e.tickets.filter((x) => x.tierId === t.id).reduce((a, x) => a + x.quantity, 0) })).filter((t) => t.q > 0),
    };
  });

  const passees = soirees.filter((s) => s.date.getTime() < maintenant);
  const caTotal = soirees.reduce((a, s) => a + s.ca, 0);
  const carresTotal = soirees.reduce((a, s) => a + s.carres, 0);
  const absentsTotal = soirees.reduce((a, s) => a + s.absents, 0);
  const viaManagerTotal = soirees.reduce((a, s) => a + s.viaManager, 0);
  const maxCa = Math.max(1, ...soirees.map((s) => s.ca));

  const ventesManager = await Promise.all(team.map(async (m) => {
    const [r, t] = await Promise.all([
      db.reservation.aggregate({ where: { venueId: venue.id, managerId: m.id, status: { not: "CANCELLED" } }, _sum: { totalCents: true }, _count: true }),
      db.ticket.aggregate({ where: { venueId: venue.id, managerId: m.id, status: { not: "CANCELLED" } }, _sum: { totalCents: true, quantity: true } }),
    ]);
    const ca = (r._sum.totalCents ?? 0) + (t._sum.totalCents ?? 0);
    return { name: m.user.name ?? "Manager", carres: r._count, entrees: t._sum.quantity ?? 0, ca, commission: Math.round((ca * (m.commissionPct ?? 0)) / 100), pct: m.commissionPct ?? 0 };
  }));
  ventesManager.sort((a, b) => b.ca - a.ca);
  const maxManager = Math.max(1, ...ventesManager.map((m) => m.ca));

  return (
    <>
      <header>
        <h1>Statistiques</h1>
        <p>Les 12 dernières soirées : ce qui remplit, ce qui rapporte, et qui vend.</p>
      </header>

      <div className="grid4" style={{ marginBottom: 20 }}>
        <div className="card"><span className="mute">Chiffre d&apos;affaires</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{eur(caTotal)}</div><span className="mute" style={{ fontSize: 12 }}>sur {soirees.length} soirée{soirees.length > 1 ? "s" : ""}</span></div>
        <div className="card"><span className="mute">Carrés vendus</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{carresTotal}</div><span className="mute" style={{ fontSize: 12 }}>{passees.length ? `${Math.round(passees.reduce((a, s) => a + s.remplissage, 0) / passees.length)} % de remplissage` : "—"}</span></div>
        <div className="card"><span className="mute">Via un manager</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{pct(viaManagerTotal, carresTotal)} %</div><span className="mute" style={{ fontSize: 12 }}>{viaManagerTotal} carré(s)</span></div>
        <div className="card"><span className="mute">Taux d&apos;absence</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{pct(absentsTotal, carresTotal + absentsTotal)} %</div><span className="mute" style={{ fontSize: 12 }}>{absentsTotal} carré(s) absent(s)</span></div>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Chiffre d&apos;affaires par soirée</h2>
        {soirees.length === 0 ? <p className="mute">Pas encore de soirée.</p> : (
          <div className="bars">
            {[...soirees].reverse().map((s) => (
              <div key={s.id} className="bar">
                <i style={{ height: `${Math.max(3, (s.ca / maxCa) * 100)}%` }} />
                <b>{eur(s.ca)}</b>
                <span>{jour(s.date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 18, overflowX: "auto" }}>
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Détail par soirée</h2>
        <table className="list">
          <thead><tr><th>Soirée</th><th>Carrés</th><th>Remplissage</th><th>Panier moyen</th><th>Entrées</th><th>CA carrés</th><th>CA entrées</th><th>Réservé en avance</th></tr></thead>
          <tbody>
            {soirees.length === 0 && <tr><td colSpan={8} className="mute">Rien à afficher.</td></tr>}
            {soirees.map((s) => (
              <tr key={s.id}>
                <td style={{ textTransform: "capitalize" }}>{jour(s.date)}<br /><span className="mute">{s.name}</span></td>
                <td>{s.carres} / {tables}</td>
                <td>{s.remplissage} %</td>
                <td>{s.panier ? eur(s.panier) : <span className="mute">—</span>}</td>
                <td>{s.entrees || <span className="mute">—</span>}</td>
                <td>{eur(s.caTables)}</td>
                <td>{eur(s.caTickets)}</td>
                <td>{s.delaiMoyen ? `${s.delaiMoyen} j` : <span className="mute">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ventes par manager</h2>
          {ventesManager.length === 0 ? <p className="mute">Aucun manager commercial dans l&apos;équipe.</p> : (
            <div style={{ display: "grid", gap: 10 }}>
              {ventesManager.map((m) => (
                <div key={m.name} style={{ display: "grid", gap: 4 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b>{m.name}</b>
                    <span>{eur(m.ca)} <span className="mute">· {m.carres} carré(s), {m.entrees} entrée(s)</span></span>
                  </div>
                  <div className="track"><i style={{ width: `${(m.ca / maxManager) * 100}%` }} /></div>
                  <span className="mute" style={{ fontSize: 12 }}>Commission {m.pct} % : {eur(m.commission)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 style={{ fontSize: 17, marginBottom: 14 }}>Entrées par tarif</h2>
          {(() => {
            const total = new Map<string, number>();
            for (const s of soirees) for (const t of s.tiers) total.set(t.name, (total.get(t.name) ?? 0) + t.q);
            const rows = [...total.entries()].sort((a, b) => b[1] - a[1]);
            const max = Math.max(1, ...rows.map((r) => r[1]));
            if (rows.length === 0) return <p className="mute">Aucune entrée vendue pour l&apos;instant.</p>;
            return (
              <div style={{ display: "grid", gap: 10 }}>
                {rows.map(([name, q]) => (
                  <div key={name} style={{ display: "grid", gap: 4 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}><b>{name}</b><span>{q}</span></div>
                    <div className="track"><i style={{ width: `${(q / max) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      </div>
    </>
  );
}
