import "server-only";
import { db } from "@/lib/db";
import { onboardingFromLook, themeFromLook, type Look } from "@/lib/look";

/** Couleurs de départ des catégories : elles servent au plan et à la vue 3D. */
const CAT_COLORS = ["#ff5fa2", "#a970ff", "#4fd8ff", "#ffd25f", "#7dffa8", "#ff8a5f"];

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "club";

/**
 * Crée l'établissement d'un utilisateur, à son image : ambiance choisie sur la page d'accueil,
 * réponses du questionnaire d'accueil, catégories de départ selon le type de lieu.
 * Fonction serveur ordinaire (pas une action) : on ne l'appelle qu'après avoir vérifié l'utilisateur.
 */
export async function createVenueFor(userId: string, v: { name: string; city: string | null; kind: "club" | "beach" }, look: Look) {
  const { name, city, kind } = v;
  let slug = slugify(name);
  for (let i = 2; await db.venue.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;

  const cats =
    kind === "beach"
      ? [["Cabana", 50, 2, 1200], ["Lit balinais", 30, 1, 600], ["Transat", 0, 0, 150]]
      : [["Prestige", 50, 3, 1500], ["Scène", 30, 2, 800], ["Lounge", 20, 1, 400], ["Table haute", 0, 0, 150]];

  await db.venue.create({
    data: {
      name, city: city || null, kind, slug,
      theme: themeFromLook(kind, look),
      onboarding: onboardingFromLook(look),
      websiteUrl: look.site ?? null,
      rules: kind === "beach" ? "18 ans et plus. Maillot accepté jusqu'à 20 h, tenue de soirée ensuite." : "18 ans et plus. Tenue correcte exigée.",
      memberships: { create: { userId, role: "OWNER" } },
      categories: { create: cats.map(([n, dep, inc, min], i) => ({ name: n as string, depositPct: dep as number, includedShows: inc as number, minSpendCents: (min as number) * 100, sortOrder: i, color: CAT_COLORS[i % CAT_COLORS.length], elevation: [5, 7, 2, 1][i] ?? 2 })) },
    },
  });
  return slug;
}
