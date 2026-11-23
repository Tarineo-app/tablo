import "server-only";
import { db } from "./db";

/**
 * Le fichier clients se déduit des ventes : aucune saisie pour le club.
 * La clé est l'email (sinon le téléphone), en minuscules.
 */
export type Client = {
  key: string;
  name: string;
  email: string;
  phone: string;
  tables: number;
  tickets: number;
  visits: number;
  spentCents: number;
  lastAt: Date;
  firstAt: Date;
  managers: string[];
  occasions: string[];
  bottles: { label: string; quantity: number }[];
};

const keyOf = (email: string, phone: string) => (email || phone).trim().toLowerCase();

export async function loadClients(venueId: string, managerId?: string): Promise<Client[]> {
  const only = managerId ? { managerId } : {};
  const [resas, tickets] = await Promise.all([
    db.reservation.findMany({
      where: { venueId, status: { not: "CANCELLED" }, ...only },
      include: {
        manager: { include: { user: { select: { name: true } } } },
        orders: { include: { items: { include: { bottleSize: { include: { bottle: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    db.ticket.findMany({ where: { venueId, status: { not: "CANCELLED" }, ...only }, include: { manager: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 4000 }),
  ]);

  const map = new Map<string, Client & { bottleCount: Map<string, number> }>();
  const touch = (key: string, name: string, email: string, phone: string, at: Date, manager: string | null) => {
    let c = map.get(key);
    if (!c) {
      c = { key, name, email, phone, tables: 0, tickets: 0, visits: 0, spentCents: 0, lastAt: at, firstAt: at, managers: [], occasions: [], bottles: [], bottleCount: new Map() };
      map.set(key, c);
    }
    if (at > c.lastAt) { c.lastAt = at; c.name = name || c.name; }
    if (at < c.firstAt) c.firstAt = at;
    if (!c.phone && phone) c.phone = phone;
    if (!c.email && email) c.email = email;
    if (manager && !c.managers.includes(manager)) c.managers.push(manager);
    return c;
  };

  for (const r of resas) {
    const key = keyOf(r.organizerEmail, r.organizerPhone);
    if (!key) continue;
    const c = touch(key, r.organizerName, r.organizerEmail, r.organizerPhone, r.createdAt, r.manager?.user.name ?? null);
    c.tables += 1;
    c.visits += 1;
    c.spentCents += r.totalCents;
    if (r.signText && !c.occasions.includes(r.signText)) c.occasions.push(r.signText);
    for (const o of r.orders) for (const it of o.items) {
      const label = `${it.bottleSize.bottle.name} ${it.bottleSize.label}`;
      c.bottleCount.set(label, (c.bottleCount.get(label) ?? 0) + it.quantity);
    }
  }
  for (const t of tickets) {
    const key = keyOf(t.buyerEmail, t.buyerPhone ?? "");
    if (!key) continue;
    const c = touch(key, t.buyerName, t.buyerEmail, t.buyerPhone ?? "", t.createdAt, t.manager?.user.name ?? null);
    c.tickets += t.quantity;
    c.visits += 1;
    c.spentCents += t.totalCents;
  }

  return [...map.values()]
    .map(({ bottleCount, ...c }) => ({ ...c, bottles: [...bottleCount.entries()].map(([label, quantity]) => ({ label, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5) }))
    .sort((a, b) => b.spentCents - a.spentCents);
}
