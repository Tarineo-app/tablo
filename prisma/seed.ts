// Données de démo : le club fictif « Le Velours » (Rouen) avec un compte propriétaire.
// Lancer avec : npx prisma db seed
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { defaultTheme } from "../src/lib/theme";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// En local, mot de passe connu pour se connecter facilement. En ligne, mot de passe
// aléatoire jamais affiché : on entre dans la démo par /demo-club, qui bride les actions sensibles.
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
const demoPassword = local ? "tablo-demo" : randomBytes(24).toString("base64url");

// Soirées de démo : on en recrée dès qu'il n'en reste plus à venir, pour que la démo ne vieillisse pas.
async function ensureEvents(venueId: string) {
  const upcoming = await db.event.count({ where: { venueId, date: { gte: new Date() } } });
  if (upcoming > 0) return;
  const next = new Date();
  const dates: [number, string][] = [[5, "Afro Night"], [6, "Velvet Gold"], [6, "Nuit Vénitienne"]];
  for (const [weekday, name] of dates) {
    const d = new Date(next);
    d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7 || 7) + (name === "Nuit Vénitienne" ? 7 : 0));
    d.setUTCHours(12, 0, 0, 0);
    await db.event.create({
      data: {
        venueId, date: d, name,
        // Billetterie : le prix monte avec l'heure d'arrivée.
        ticketTiers: {
          create: [
            { name: "Early", priceCents: 0, drinks: 0, untilTime: "23:30", quota: 80, sortOrder: 0 },
            { name: "Avant minuit", priceCents: 1000, drinks: 0, untilTime: "00:30", sortOrder: 1 },
            { name: "Avant minuit + conso", priceCents: 1500, drinks: 1, untilTime: "00:30", sortOrder: 2 },
            { name: "Entrée + conso", priceCents: 2000, drinks: 1, untilTime: null, sortOrder: 3 },
          ],
        },
      },
    });
  }
  console.log("Soirées de démo ajoutées.");
}

async function main() {
  const email = "demo@tablo.club";
  const existing = await db.venue.findUnique({
    where: { slug: "le-velours" },
    include: { memberships: { where: { role: "OWNER" }, select: { user: { select: { id: true, email: true } } } } },
  });
  if (existing) {
    // Un « Le Velours » créé avant l'arrivée de isDemo : on le reconnaît à son propriétaire de démo.
    const demoOwner = existing.memberships.find((m) => m.user.email === email)?.user;
    if (!demoOwner) {
      console.log("Le Velours existe déjà et n'appartient pas au compte de démo : on n'y touche pas.");
      return;
    }
    if (!existing.isDemo) await db.venue.update({ where: { id: existing.id }, data: { isDemo: true } });
    // En ligne, le mot de passe connu « tablo-demo » ne doit pas ouvrir l'espace sans les garde-fous de la démo.
    if (!local) await db.user.update({ where: { id: demoOwner.id }, data: { passwordHash: await bcrypt.hash(demoPassword, 10) } });
    await ensureEvents(existing.id);
    console.log("Le Velours existe déjà, prêt pour la démo.");
    return;
  }
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name: "Démo Tablo", passwordHash: await bcrypt.hash(demoPassword, 10) } });
  const venue = await db.venue.create({
    data: {
      slug: "le-velours", name: "Le Velours", city: "Rouen", kind: "club", theme: defaultTheme("club"), isDemo: true, billing: "ACTIVE",
      rules: "Soirée Velvet : tenue chic exigée, 18 ans et plus. Au-delà de 20 personnes, appelez-nous.",
      memberships: { create: [{ userId: user.id, role: "OWNER" }] },
    },
  });
  const cat = async (name: string, depositPct: number, includedShows: number, min: number, sortOrder: number) =>
    db.tableCategory.create({ data: { venueId: venue.id, name, depositPct, includedShows, minSpendCents: min * 100, sortOrder } });
  const prestige = await cat("Prestige", 50, 3, 1500, 0);
  const scene = await cat("Scène", 30, 2, 800, 1);
  const lounge = await cat("Lounge", 20, 1, 400, 2);
  const haute = await cat("Table haute", 0, 0, 150, 3);

  const T = (name: string, c: { id: string }, capacity: number, x: number, y: number, w: number, h: number, min?: number) =>
    ({ venueId: venue.id, name, categoryId: c.id, capacity, x, y, w, h, minSpendCents: min ? min * 100 : null });
  await db.venueTable.createMany({
    data: [
      T("Impérial", prestige, 12, 6, 8, 22, 16, 2000), T("Royal", prestige, 10, 72, 8, 22, 16),
      T("Scène 1", scene, 8, 34, 8, 14, 12), T("Scène 2", scene, 8, 52, 8, 14, 12),
      T("Lounge 1", lounge, 6, 6, 40, 14, 14), T("Lounge 2", lounge, 6, 6, 62, 14, 14), T("Lounge 3", lounge, 6, 80, 40, 14, 14), T("Lounge 4", lounge, 6, 80, 62, 14, 14),
      T("Haute 1", haute, 4, 30, 82, 10, 10), T("Haute 2", haute, 4, 60, 82, 10, 10),
    ],
  });

  const bottle = (name: string, type: string, sizes: [string, string, number][], flavors: string[] = []) =>
    db.bottle.create({ data: { venueId: venue.id, name, type, flavors, sizes: { create: sizes.map(([label, volume, eur]) => ({ label, volume, priceCents: eur * 100 })) } } });
  const brut = await bottle("Champagne Brut", "Champagne", [["Classique", "75 cl", 180], ["Magnum", "1,5 L", 380], ["Jéroboam", "3 L", 900]]);
  await bottle("Champagne Rosé", "Champagne", [["Classique", "75 cl", 240], ["Magnum", "1,5 L", 520]]);
  await bottle("Champagne Prestige", "Champagne", [["Classique", "75 cl", 450], ["Magnum", "1,5 L", 980]]);
  await bottle("Vodka premium", "Vodka", [["Classique", "70 cl", 200], ["Magnum", "1,75 L", 420]], ["Original", "Pêche", "Ananas", "Fruits rouges"]);
  await bottle("Tequila añejo", "Tequila", [["Classique", "70 cl", 320]]);
  await bottle("Whisky 12 ans", "Whisky", [["Classique", "70 cl", 220]]);

  await db.venue.update({ where: { id: venue.id }, data: { garageEnabled: true, garageMinBottles: 1, garageDays: 60, garageKeepsMin: false } });

  const show = (name: string, description: string, price: number, cats: { id: string }[], isSign = false, option?: { minBottles: number; bottleId?: string }) =>
    db.show.create({
      data: {
        venueId: venue.id, name, description, priceCents: price * 100, isSign,
        minBottles: option?.minBottles ?? 0, bottleId: option?.bottleId ?? null,
        categories: { connect: cats.map((c) => ({ id: c.id })) },
      },
    });
  await show("Pancarte personnalisée", "La pancarte du club avec votre texte", 0, [prestige, scene, lounge, haute], true);
  await show("Parade de sparklers", "6 sparklers apportés à la table avec la bouteille", 80, [prestige, scene, lounge]);
  await show("Danseurs boule à facettes", "3 danseurs disco à votre table, 5 minutes", 150, [prestige, scene]);
  await show("Mallette lumineuse", "Bouteille servie dans une mallette LED avec fumée", 120, [prestige]);
  await show("Dédicace du DJ", "Votre prénom annoncé au micro", 50, [prestige, scene, lounge]);
  await show("Canon à confettis", "Explosion de confettis au-dessus du carré", 90, []);
  // Options liées aux bouteilles : elles apparaissent dans le choix des bouteilles.
  await show("Couronne de champagne", "Les bouteilles arrivent en couronne lumineuse, portées par l'équipe", 0, [prestige, scene], false, { minBottles: 3, bottleId: brut.id });
  await show("Cortège géant", "Cortège complet avec fumée et sparklers pour les grosses commandes", 0, [prestige], false, { minBottles: 6 });

  // Une bouteille au garage, pour la démonstration (code GDEMO1).
  const vodkaSize = await db.bottleSize.findFirst({ where: { bottle: { venueId: venue.id, name: "Vodka premium" } }, orderBy: { priceCents: "asc" } });
  if (vodkaSize) {
    await db.garageItem.create({
      data: {
        venueId: venue.id, code: "GDEMO1", bottleSizeId: vodkaSize.id,
        ownerName: "Sarah Martin", ownerEmail: "sarah@example.com", ownerPhone: "0612345678",
        quantity: 1, flavor: "Fruits rouges", note: "Entamée à moitié, bouchon marqué 14",
        expiresAt: new Date(Date.now() + 60 * 864e5),
      },
    });
  }

  await ensureEvents(venue.id);
  console.log(local
    ? "Le Velours créé. Connexion : demo@tablo.club / tablo-demo · Widget : /w/le-velours"
    : "Le Velours créé. Entrée par /demo-club · Widget : /w/le-velours");
}

main().finally(() => db.$disconnect());
