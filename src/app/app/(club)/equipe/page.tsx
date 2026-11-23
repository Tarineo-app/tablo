import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import { ROLE_DESC, ROLE_LABEL } from "@/lib/roles";
import { InviteForm, MemberRow } from "./InviteForm";

export const metadata = { title: "Équipe · Tablo" };

export default async function Page() {
  const { venue, membership } = await requireMembership(MANAGE);
  const team = await db.membership.findMany({
    where: { venueId: venue.id },
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
      reservations: { where: { status: { notIn: ["CANCELLED"] } }, select: { totalCents: true } },
      tickets: { where: { status: { not: "CANCELLED" } }, select: { totalCents: true } },
    },
  });

  return (
    <>
      <header>
        <h1>Équipe</h1>
        <p>Chacun voit ce qui le concerne : le directeur configure le club, le manager a son lien de réservation, le serveur reçoit les envois et le barman prépare au bar.</p>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <table className="list">
          <thead><tr><th>Personne</th><th>Rôle</th><th>Vendu</th><th>Compte</th><th /></tr></thead>
          <tbody>
            {team.map((m) => {
              const sold = m.reservations.reduce((a, r) => a + r.totalCents, 0) + m.tickets.reduce((a, t) => a + t.totalCents, 0);
              return (
                <tr key={m.id}>
                  <td>
                    <b>{m.user.name || m.user.email}</b>
                    <div className="mute" style={{ fontSize: 12 }}>{m.user.email}{m.id === membership.id ? " · vous" : ""}</div>
                  </td>
                  <td>
                    <b>{ROLE_LABEL[m.role]}</b>
                    <div className="mute" style={{ fontSize: 12, maxWidth: 260 }}>{ROLE_DESC[m.role]}</div>
                    {m.role === "MANAGER" && m.managerCode && <div className="mute" style={{ fontSize: 12 }}>Code : {m.managerCode}</div>}
                  </td>
                  <td>{m.role === "MANAGER" ? <>{eur(sold)}<div className="mute" style={{ fontSize: 12 }}>commission {eur(Math.round((sold * (m.commissionPct ?? 0)) / 100))}</div></> : <span className="mute">—</span>}</td>
                  <td>{m.user.passwordHash ? <span className="okmsg">Actif</span> : <span className="mute">Invitation en attente</span>}</td>
                  <td>
                    <MemberRow id={m.id} role={m.role} commissionPct={m.commissionPct}
                      canManage={m.role !== "OWNER" && m.id !== membership.id && (membership.role === "OWNER" || m.role !== "DIRECTOR")}
                      activated={!!m.user.passwordHash} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 6 }}>Inviter quelqu&apos;un</h2>
        <p className="mute" style={{ marginTop: 0, marginBottom: 14, fontSize: 14 }}>
          La personne reçoit un lien pour choisir son mot de passe, ou se connecte avec Google. Le lien est valable 7 jours.
        </p>
        <InviteForm canInviteDirector={membership.role === "OWNER"} />
      </section>
    </>
  );
}
