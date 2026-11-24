import Link from "next/link";
import BlockForm from "./BlockForm";
import { notFound } from "next/navigation";
import { addTier, copyTiers, deleteTier, toggleTier } from "@/app/actions/tickets";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import { SOLD, fmtTime } from "@/lib/tickets";

export const metadata = { title: "Billetterie · Tablo" };
const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const STATUS: Record<string, string> = { PENDING: "À payer", PAID: "Payé", CHECKED_IN: "Entré", CANCELLED: "Annulé" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { venue } = await requireMembership(MANAGE);
  const event = await db.event.findFirst({
    where: { id, venueId: venue.id },
    include: {
      ticketTiers: { orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }], include: { tickets: { where: { status: { in: [...SOLD] } }, select: { quantity: true, totalCents: true } } } },
      tickets: { orderBy: { createdAt: "desc" }, take: 200, include: { tier: true } },
    },
  });
  if (!event) notFound();
  const [tables, taken] = await Promise.all([
    db.venueTable.findMany({ where: { venueId: venue.id, active: true }, orderBy: { name: "asc" }, include: { category: { select: { name: true, minSpendCents: true } } } }),
    db.reservation.findMany({
      where: { eventId: id, venueId: venue.id, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      select: { id: true, tableId: true, organizerName: true, organizerPhone: true, guests: true, organizerEmail: true },
    }),
  ]);
  const takenIds = new Set(taken.map((r) => r.tableId));
  const tableName = new Map(tables.map((t) => [t.id, t.name]));
  // Un carré bloqué à la main n'a pas d'email : c'est ce qui le distingue d'une vraie réservation en ligne.
  const held = taken.filter((r) => r.organizerEmail === "").map((r) => ({
    id: r.id, tableName: tableName.get(r.tableId) ?? "Carré", name: r.organizerName, phone: r.organizerPhone, guests: r.guests,
  }));
  const free = tables.filter((t) => !takenIds.has(t.id)).map((t) => ({ id: t.id, label: `${t.name} · ${t.category.name} · ${t.capacity} pers.` }));

  const others = await db.event.findMany({ where: { venueId: venue.id, id: { not: id }, ticketTiers: { some: {} } }, orderBy: { date: "desc" }, take: 6 });
  const sold = event.ticketTiers.flatMap((t) => t.tickets);
  const count = sold.reduce((a, t) => a + t.quantity, 0);
  const revenue = sold.reduce((a, t) => a + t.totalCents, 0);

  return (
    <>
      <header>
        <p className="mute" style={{ margin: 0 }}><Link href="/app/soirees">← Soirées</Link></p>
        <h1 style={{ textTransform: "capitalize" }}>{event.name || "Soirée"} · {fmt(event.date)}</h1>
        <p>{venue.ticketsEnabled
          ? "Tenez les carrés promis en dehors de l'application, et vendez les entrées avec des prix qui montent au fil de la soirée."
          : "Tenez ici les carrés promis au téléphone ou en direct : ils sortent de la vente en ligne tout de suite."}</p>
      </header>

      <BlockForm eventId={event.id} free={free} held={held} />

      {venue.ticketsEnabled && (
        <>
      <div className="grid3" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Entrées vendues</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{count}</div></div>
        <div className="card"><span className="mute">Chiffre billetterie</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{eur(revenue)}</div></div>
        <div className="card"><span className="mute">Lien direct</span><div style={{ marginTop: 10 }}><a href={`/w/${venue.slug}/billets`} target="_blank" rel="noreferrer">/w/{venue.slug}/billets ↗</a></div></div>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>Tarifs</h2>
        <table className="list">
          <thead><tr><th>Tarif</th><th>Arrivée</th><th>Conso</th><th>Prix</th><th>Vendues</th><th>État</th><th /></tr></thead>
          <tbody>
            {event.ticketTiers.length === 0 && <tr><td colSpan={7} className="mute">Aucun tarif. Ajoutez-en un ci-dessous, par exemple « Avant minuit · 10 € sans conso ».</td></tr>}
            {event.ticketTiers.map((t) => {
              const n = t.tickets.reduce((a, x) => a + x.quantity, 0);
              return (
                <tr key={t.id}>
                  <td><b>{t.name}</b></td>
                  <td>{t.untilTime ? `avant ${fmtTime(t.untilTime)}` : "toute la nuit"}</td>
                  <td>{t.drinks === 0 ? "sans" : t.drinks}</td>
                  <td>{t.priceCents ? eur(t.priceCents) : "Gratuit"}</td>
                  <td>{n}{t.quota !== null ? ` / ${t.quota}` : ""}</td>
                  <td><ConfirmButton className="btn btn-out" label={t.active ? "En vente" : "Arrêté"} run={toggleTier.bind(null, t.id)} /></td>
                  <td><ConfirmButton label="Supprimer" confirm="Supprimer ce tarif ?" run={deleteTier.bind(null, t.id)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {others.length > 0 && event.ticketTiers.length === 0 && (
          <div className="row" style={{ marginTop: 14 }}>
            <span className="mute">Reprendre les tarifs de :</span>
            {others.map((o) => <ConfirmButton key={o.id} className="btn btn-out" label={o.name || fmt(o.date)} run={copyTiers.bind(null, event.id, o.id)} />)}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ajouter un tarif</h2>
        <ActionForm action={addTier.bind(null, event.id)} submit="Ajouter le tarif" resetOnOk>
          <div className="grid2">
            <label className="field">Nom<input className="input" name="name" required placeholder="Ex. Early, Avant minuit, Entrée + conso" /></label>
            <label className="field">Prix (€)<input className="input" name="price" inputMode="decimal" required placeholder="10" /></label>
            <label className="field">Arrivée avant (laisser vide = toute la nuit)<input className="input" type="time" name="untilTime" /></label>
            <label className="field">Consommations incluses
              <select className="input" name="drinks" defaultValue="0"><option value="0">Sans conso</option><option value="1">1 conso</option><option value="2">2 consos</option><option value="3">3 consos</option></select>
            </label>
            <label className="field">Places à ce tarif (facultatif)<input className="input" name="quota" inputMode="numeric" placeholder="Ex. 100 pour un tarif early" /></label>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 12 }}>Billets vendus</h2>
        <table className="list">
          <thead><tr><th>Nom</th><th>Tarif</th><th>Entrées</th><th>Montant</th><th>Code</th><th>État</th></tr></thead>
          <tbody>
            {event.tickets.length === 0 && <tr><td colSpan={6} className="mute">Aucun billet vendu pour l&apos;instant.</td></tr>}
            {event.tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.buyerName}<div className="mute" style={{ fontSize: 12 }}>{t.buyerEmail}</div></td>
                <td>{t.tier.name}</td>
                <td>{t.checkedIn ? `${t.checkedIn} / ${t.quantity}` : t.quantity}</td>
                <td>{eur(t.totalCents)}</td>
                <td style={{ fontFamily: "monospace" }}>{t.qrToken}</td>
                <td>{STATUS[t.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
        </>
      )}
    </>
  );
}
