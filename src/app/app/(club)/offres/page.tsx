import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { yesterday } from "@/lib/dates";
import { eur } from "@/lib/money";
import { lineLabel } from "@/lib/offers";
import OfferComposer from "./OfferComposer";
import OfferRow from "./OfferRow";

export const metadata = { title: "Mes offres · Tablo" };

const day = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export default async function Page() {
  const { venue, membership } = await requireMembership(["OWNER", "DIRECTOR", "MANAGER"]);
  const mine = membership.role === "MANAGER" ? { managerId: membership.id } : {};

  const [events, tables, bottles, shows, offers] = await Promise.all([
    db.event.findMany({ where: { venueId: venue.id, date: { gte: yesterday() } }, orderBy: { date: "asc" }, take: 20, select: { id: true, date: true, name: true } }),
    db.venueTable.findMany({ where: { venueId: venue.id, active: true }, orderBy: { name: "asc" }, include: { category: { select: { name: true, minSpendCents: true } } } }),
    db.bottle.findMany({ where: { venueId: venue.id, active: true }, orderBy: { name: "asc" }, include: { sizes: { orderBy: { priceCents: "asc" } } } }),
    db.show.findMany({ where: { venueId: venue.id, active: true }, orderBy: { priceCents: "asc" }, select: { id: true, name: true, priceCents: true, isSign: true } }),
    db.offer.findMany({
      where: { venueId: venue.id, ...mine },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        event: { select: { date: true, name: true } },
        table: { select: { name: true } },
        manager: { include: { user: { select: { name: true, email: true } } } },
        items: { orderBy: { sortOrder: "asc" }, include: { bottleSize: { include: { bottle: true } }, show: true } },
      },
    }),
  ]);

  const asked = offers.filter((o) => o.status === "REQUESTED");
  const rest = offers.filter((o) => o.status !== "REQUESTED");

  return (
    <>
      <header>
        <h1>Mes offres</h1>
        <p>
          Composez la soirée d&apos;un client, fixez <b>votre</b> prix, envoyez le lien. Il accepte en un clic et la réservation
          se crée toute seule. Ce que vous offrez au passage — un show, la pancarte, une bouteille — s&apos;affiche en clair : c&apos;est votre argument.
        </p>
      </header>

      {asked.length > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, marginTop: 0 }}>{asked.length} client{asked.length > 1 ? "s attendent" : " attend"} votre prix</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {asked.map((o) => (
              <div key={o.id} className="askrow">
                <div>
                  <b>{o.clientName ?? "Client"}</b>
                  <span>{day(o.event.date)} · {o.guests} personnes{o.table ? ` · ${o.table.name}` : ""}{o.clientPhone ? ` · ${o.clientPhone}` : ""}</span>
                  {o.askNote && <em>« {o.askNote} »</em>}
                </div>
                <OfferRow offer={{ id: o.id, code: o.code, status: o.status, clientEmail: o.clientEmail }} />
              </div>
            ))}
          </div>
        </section>
      )}

      <OfferComposer
        events={events.map((e) => ({ id: e.id, label: `${day(e.date)}${e.name ? ` · ${e.name}` : ""}` }))}
        tables={tables.map((t) => ({ id: t.id, label: `${t.name} · ${t.category.name} · min ${eur(t.minSpendCents ?? t.category.minSpendCents)}`, capacity: t.capacity }))}
        bottles={bottles.flatMap((b) => b.sizes.map((s) => ({ id: s.id, label: `${b.name} ${s.label}`, priceCents: s.priceCents, flavors: b.flavors })))}
        shows={shows.map((s) => ({ id: s.id, label: s.name + (s.isSign ? " (pancarte)" : ""), priceCents: s.priceCents }))}
      />

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 17, marginTop: 0 }}>Envoyées</h2>
        {rest.length === 0 ? (
          <p className="mute" style={{ margin: 0 }}>Aucune offre pour l&apos;instant.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="list">
              <thead><tr><th>Client</th><th>Soirée</th><th>Contenu</th><th>Prix</th><th>État</th><th /></tr></thead>
              <tbody>
                {rest.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.clientName ?? "—"}</b><br /><small className="mute">{o.clientPhone ?? o.clientEmail ?? ""}</small></td>
                    <td>{day(o.event.date)}<br /><small className="mute">{o.table?.name ?? "carré à définir"}</small></td>
                    <td><small className="mute">{o.items.slice(0, 3).map((i) => lineLabel(i)).join(", ")}{o.items.length > 3 ? "…" : ""}</small></td>
                    <td><b>{eur(o.priceCents)}</b>{o.listCents > o.priceCents && <><br /><small className="mute">offert {eur(o.listCents - o.priceCents)}</small></>}</td>
                    <td><span className={`pill ${o.status.toLowerCase()}`}>{LABEL[o.status]}</span></td>
                    <td><OfferRow offer={{ id: o.id, code: o.code, status: o.status, clientEmail: o.clientEmail }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

const LABEL: Record<string, string> = {
  REQUESTED: "À chiffrer", SENT: "Envoyée", ACCEPTED: "Acceptée",
  DECLINED: "Refusée", EXPIRED: "Expirée", CANCELLED: "Annulée",
};
