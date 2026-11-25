import "server-only";
import { db } from "./db";
import { gateFor } from "./billing";
import { readTheme } from "./theme";
import { SOLD, tierDeadline } from "./tickets";
import { occupying } from "./holds";

/** Tout ce dont le widget public a besoin, en données simples (envoyées au navigateur). */
export async function loadWidget(slug: string) {
  const venue = await db.venue.findUnique({ where: { slug } });
  if (!venue) return null;
  const today = new Date(Date.now() - 12 * 3600e3);
  const [categories, tables, bottles, shows, events] = await Promise.all([
    db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" } }),
    db.venueTable.findMany({ where: { venueId: venue.id, active: true } }),
    db.bottle.findMany({ where: { venueId: venue.id, active: true }, include: { sizes: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } }),
    db.show.findMany({ where: { venueId: venue.id, active: true }, include: { categories: { select: { id: true } } }, orderBy: { priceCents: "asc" } }),
    db.event.findMany({
      where: { venueId: venue.id, isOpen: true, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 12,
      include: {
        reservations: { where: occupying(), select: { tableId: true } }, prices: true,
        ticketTiers: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }], include: { tickets: { where: { status: { in: [...SOLD] } }, select: { quantity: true } } } },
      },
    }),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  return {
    venue: {
      name: venue.name, slug: venue.slug, kind: venue.kind, city: venue.city, rules: venue.rules, planImageUrl: venue.planImageUrl, payModes: venue.payModes, ticketsEnabled: venue.ticketsEnabled,
      garage: { enabled: venue.garageEnabled, minBottles: venue.garageMinBottles, keepsMin: venue.garageKeepsMin },
      plan3d: venue.plan3d, planTilt: venue.planTilt, wallColor: venue.wallColor, tour3dUrl: venue.tour3dUrl,
      gate: gateFor(venue),
      theme: readTheme(venue.theme, venue.kind),
    },
    categories: categories.map((c) => ({ id: c.id, name: c.name, depositPct: c.depositPct, includedShows: c.includedShows, color: c.color, elevation: c.elevation, furniture: c.furniture })),
    tables: tables.map((t) => ({
      id: t.id, name: t.name, categoryId: t.categoryId, capacity: t.capacity,
      minSpendCents: t.minSpendCents ?? catById.get(t.categoryId)?.minSpendCents ?? 0,
      photoUrl: t.photoUrl, color: catById.get(t.categoryId)?.color ?? null, elevation: catById.get(t.categoryId)?.elevation ?? 2,
      x: t.x, y: t.y, w: t.w, h: t.h,
    })),
    bottles: bottles.map((b) => ({ id: b.id, name: b.name, type: b.type, photoUrl: b.photoUrl, flavors: b.flavors, sizes: b.sizes.map((s) => ({ id: s.id, bottleId: b.id, label: s.label, volume: s.volume, priceCents: s.priceCents, soldOut: s.stock === 0 })) })),
    shows: shows.map((s) => ({ id: s.id, name: s.name, description: s.description, priceCents: s.priceCents, mediaUrl: s.mediaUrl, isSign: s.isSign, minBottles: s.minBottles, bottleId: s.bottleId, categoryIds: s.categories.map((c) => c.id) })),
    events: events.map((e) => ({
      open: gateFor(venue, e.id).open,
      closedNote: gateFor(venue, e.id).message,
      id: e.id, date: e.date.toISOString(), name: e.name,
      taken: [...new Set(e.reservations.map((r) => r.tableId))],
      prices: Object.fromEntries(e.prices.map((p) => [p.tableId, p.minSpendCents])),
      tiers: e.ticketTiers.map((t) => {
        const sold = t.tickets.reduce((a, x) => a + x.quantity, 0);
        const dl = tierDeadline(e.date, t.untilTime);
        return { id: t.id, name: t.name, priceCents: t.priceCents, drinks: t.drinks, untilTime: t.untilTime, left: t.quota === null ? null : Math.max(0, t.quota - sold), closed: !!dl && dl.getTime() < Date.now() };
      }),
    })),
  };
}

export type WidgetData = NonNullable<Awaited<ReturnType<typeof loadWidget>>>;
