import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { tonight, yesterday } from "@/lib/dates";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import { isFloor } from "@/lib/roles";
import ManagerHome from "./ManagerHome";
import Tonight, { type FloorTable } from "./Tonight";
import TrialBanner from "@/components/TrialBanner";
import { closeTrialIfOver, trialReport } from "@/lib/billing";
import { occupying } from "@/lib/holds";

export const metadata = { title: "Ce soir · Tablo" };

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default async function Page() {
  const { venue, membership } = await requireMembership();
  if (isFloor(membership.role)) redirect("/app/service");
  await closeTrialIfOver(venue.id);
  const v = await db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { billing: true, trialEventId: true } });
  const trialEvent = v.trialEventId ? await db.event.findUnique({ where: { id: v.trialEventId }, select: { id: true, name: true, date: true } }) : null;
  const banner = (
    <TrialBanner
      billing={v.billing}
      trialEvent={trialEvent}
      upcoming={v.billing === "SETUP" ? await db.event.findMany({ where: { venueId: venue.id, date: { gte: yesterday() } }, orderBy: { date: "asc" }, take: 6, select: { id: true, name: true, date: true } }) : []}
      report={v.billing === "LOCKED" && v.trialEventId ? await trialReport(venue.id, v.trialEventId) : null}
    />
  );

  if (membership.role === "MANAGER") return <ManagerHome membershipId={membership.id} code={membership.managerCode} pct={membership.commissionPct ?? 0} slug={venue.slug} />;

  const event = await db.event.findFirst({ where: { venueId: venue.id, date: tonight() }, orderBy: { date: "asc" } });

  if (!event) {
    const [next, tables, events] = await Promise.all([
      db.event.findFirst({ where: { venueId: venue.id, date: { gte: yesterday() } }, orderBy: { date: "asc" }, include: { _count: { select: { reservations: true, tickets: true } } } }),
      db.venueTable.count({ where: { venueId: venue.id, active: true } }),
      db.event.count({ where: { venueId: venue.id, isOpen: true, date: { gte: yesterday() } } }),
    ]);
    return (
      <>
        {banner}
        <header>
          <h1>Pas de soirée <span className="holo">ce soir</span></h1>
          <p>{next ? <>Prochaine : <b style={{ color: "var(--text)", textTransform: "capitalize" }}>{jour(next.date)}</b>{next.name ? ` · ${next.name}` : ""}.</> : "Ajoutez une date dans Soirées et billetterie pour ouvrir les réservations."}</p>
        </header>
        <div className="grid3">
          {next && <div className="card"><span className="mute">Carrés déjà réservés</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{next._count.reservations} / {tables}</div></div>}
          {next && <div className="card"><span className="mute">Billets vendus</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{next._count.tickets}</div></div>}
          <div className="card"><span className="mute">Soirées ouvertes</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{events}</div></div>
        </div>
        <section className="card" style={{ marginTop: 18 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-main" href="/app/soirees">Soirées et billetterie</Link>
            <Link className="btn btn-out" href="/app/ventes">Voir les ventes</Link>
            <Link className="btn btn-out" href="/app/reglages">Réglages du club</Link>
          </div>
        </section>
      </>
    );
  }

  const [tables, resas, tickets] = await Promise.all([
    db.venueTable.findMany({ where: { venueId: venue.id, active: true }, include: { category: true }, orderBy: { name: "asc" } }),
    db.reservation.findMany({
      where: { venueId: venue.id, eventId: event.id, ...occupying() },
      include: { manager: { include: { user: { select: { name: true } } } }, garageItem: { include: { bottleSize: { include: { bottle: true } } } }, _count: { select: { orders: true } } },
    }),
    db.ticket.aggregate({ where: { eventId: event.id, status: { not: "CANCELLED" } }, _sum: { quantity: true, checkedIn: true, totalCents: true } }),
  ]);

  const byTable = new Map(resas.map((r) => [r.tableId, r]));
  const floor: FloorTable[] = tables.map((t) => {
    const r = byTable.get(t.id);
    return {
      id: t.id, name: t.name, category: t.category.name, capacity: t.capacity,
      minSpendCents: t.minSpendCents ?? t.category.minSpendCents,
      x: t.x, y: t.y, w: t.w, h: t.h,
      resa: r
        ? {
            id: r.id, name: r.organizerName, phone: r.organizerPhone, email: r.organizerEmail, guests: r.guests,
            totalCents: r.totalCents, paidCents: r.paidCents, status: r.status,
            manager: r.manager?.user.name ?? null, orders: r._count.orders,
            garage: r.garageItem ? `${r.garageItem.bottleSize.bottle.name} ${r.garageItem.bottleSize.label}` : null,
          }
        : null,
    };
  });

  const vendu = resas.reduce((a, r) => a + r.totalCents, 0) + (tickets._sum.totalCents ?? 0);
  const arrives = resas.filter((r) => r.status === "CHECKED_IN").length;

  return (
    <>
      {banner}
      <header>
        <h1><span className="holo">{event.name || "Ce soir"}</span></h1>
        <p style={{ textTransform: "capitalize" }}>{jour(event.date)}</p>
      </header>
      <div className="grid4" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Carrés</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{resas.length} / {tables.length}</div><span className="mute" style={{ fontSize: 12 }}>{arrives} arrivé{arrives > 1 ? "s" : ""}</span></div>
        <div className="card"><span className="mute">Entrées vendues</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{tickets._sum.quantity ?? 0}</div><span className="mute" style={{ fontSize: 12 }}>{tickets._sum.checkedIn ?? 0} entré{(tickets._sum.checkedIn ?? 0) > 1 ? "s" : ""}</span></div>
        <div className="card"><span className="mute">Vendu ce soir</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{eur(vendu)}</div></div>
        <div className="card"><span className="mute">Panier moyen carré</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{resas.length ? eur(Math.round(resas.reduce((a, r) => a + r.totalCents, 0) / resas.length)) : "—"}</div></div>
      </div>
      <Tonight tables={floor} eventId={event.id} planImageUrl={venue.planImageUrl} garageEnabled={venue.garageEnabled} />
    </>
  );
}
