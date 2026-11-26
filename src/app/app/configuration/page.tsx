import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { readTheme } from "@/lib/theme";
import { furnitureOf } from "@/lib/furniture";
import { stripeConfigured } from "@/lib/stripe";
import { yesterday } from "@/lib/dates";
import Setup, { type SetupData } from "./Setup";
import "../../w/widget.css";

export const metadata = { title: "Configuration · Tablo" };

/** Capacité proposée par défaut selon la place de la catégorie (la plus chère d'abord). */
const CAP = { club: [10, 8, 6, 4], beach: [8, 4, 2] };

/**
 * Configuration guidée après l'inscription : ambiance, carrés, bouteilles, shows, première soirée,
 * paiements des clients, puis mise en ligne (abonnement à 200 €, satisfait ou remboursé).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const { venue, user } = await requireMembership(MANAGE);
  const { etape } = await searchParams;
  const [cats, tables, bottles, shows, events, v] = await Promise.all([
    db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" } }),
    db.venueTable.findMany({ where: { venueId: venue.id, active: true }, include: { category: true }, orderBy: { name: "asc" } }),
    db.bottle.findMany({ where: { venueId: venue.id }, include: { sizes: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } }),
    db.show.findMany({ where: { venueId: venue.id }, orderBy: { name: "asc" } }),
    db.event.findMany({ where: { venueId: venue.id, date: { gte: yesterday() } }, orderBy: { date: "asc" }, take: 6 }),
    db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { onboarding: true, billing: true, subscriptionStatus: true, stripeChargesEnabled: true } }),
  ]);
  const ob = (v.onboarding && typeof v.onboarding === "object" ? v.onboarding : {}) as { done?: string[] };
  const kind = venue.kind === "beach" ? "beach" : "club";

  const data: SetupData = {
    firstName: (user.name ?? "").split(" ")[0] || "",
    venue: { name: venue.name, slug: venue.slug, kind, planImageUrl: venue.planImageUrl, wallColor: venue.wallColor, tilt: venue.planTilt || 52 },
    theme: readTheme(venue.theme, venue.kind),
    cats: cats.map((c, i) => ({
      id: c.id, name: c.name, color: c.color, minEuros: c.minSpendCents / 100, depositPct: c.depositPct,
      count: tables.filter((t) => t.categoryId === c.id).length, capacity: tables.find((t) => t.categoryId === c.id)?.capacity ?? CAP[kind][i] ?? 6,
    })),
    tables: tables.map((t) => ({
      id: t.id, name: t.name, sub: `min ${((t.minSpendCents ?? t.category.minSpendCents) / 100).toLocaleString("fr-FR")} €`,
      x: t.x, y: t.y, w: t.w, h: t.h, elevation: t.category.elevation, color: t.category.color, photoUrl: t.photoUrl,
      taken: false, small: false, kind: furnitureOf(t.category, t.name),
    })),
    bottles: bottles.map((b) => ({ id: b.id, name: b.name, type: b.type, photoUrl: b.photoUrl, active: b.active, catalogId: b.catalogId, flavors: b.flavors, sizes: b.sizes.map((s) => ({ id: s.id, label: s.label, volume: s.volume, priceCents: s.priceCents, stock: s.stock })) })),
    shows: shows.filter((s) => s.active || s.isSign).map((s) => ({ id: s.id, name: s.name, price: s.priceCents / 100, description: s.description, mediaUrl: s.mediaUrl, isSign: s.isSign, active: s.active })),
    tablesFull: tables.map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, capacity: t.capacity, minCents: t.minSpendCents, photoUrl: t.photoUrl })),
    events: events.map((e) => ({ id: e.id, name: e.name, date: e.date.toISOString() })),
    done: ob.done ?? [],
    chargesEnabled: v.stripeChargesEnabled,
    stripe: stripeConfigured(),
    live: v.billing === "ACTIVE" || (!!v.subscriptionStatus && ["active", "trialing", "past_due"].includes(v.subscriptionStatus)),
  };
  return <Setup data={data} initialStep={etape} />;
}
