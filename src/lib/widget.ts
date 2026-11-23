import "server-only";
import { db } from "./db";
import { readTheme } from "./theme";

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
      include: { reservations: { where: { status: { notIn: ["CANCELLED"] } }, select: { tableId: true } }, prices: true },
    }),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  return {
    venue: { name: venue.name, slug: venue.slug, kind: venue.kind, city: venue.city, rules: venue.rules, planImageUrl: venue.planImageUrl, payModes: venue.payModes, theme: readTheme(venue.theme, venue.kind) },
    categories: categories.map((c) => ({ id: c.id, name: c.name, depositPct: c.depositPct, includedShows: c.includedShows })),
    tables: tables.map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, capacity: t.capacity, minSpendCents: t.minSpendCents ?? catById.get(t.categoryId)?.minSpendCents ?? 0, x: t.x, y: t.y, w: t.w, h: t.h })),
    bottles: bottles.map((b) => ({ id: b.id, name: b.name, type: b.type, photoUrl: b.photoUrl, flavors: b.flavors, sizes: b.sizes.map((s) => ({ id: s.id, label: s.label, volume: s.volume, priceCents: s.priceCents, soldOut: s.stock === 0 })) })),
    shows: shows.map((s) => ({ id: s.id, name: s.name, description: s.description, priceCents: s.priceCents, mediaUrl: s.mediaUrl, isSign: s.isSign, categoryIds: s.categories.map((c) => c.id) })),
    events: events.map((e) => ({
      id: e.id, date: e.date.toISOString(), name: e.name,
      taken: [...new Set(e.reservations.map((r) => r.tableId))],
      prices: Object.fromEntries(e.prices.map((p) => [p.tableId, p.minSpendCents])),
    })),
  };
}

export type WidgetData = NonNullable<Awaited<ReturnType<typeof loadWidget>>>;
