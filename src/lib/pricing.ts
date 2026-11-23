// Calculs partagés entre le navigateur (affichage) et le serveur (qui fait foi).

/**
 * Règle des shows offerts : parmi les shows choisis qui sont éligibles pour la catégorie du carré,
 * les plus chers sont offerts, dans la limite du nombre de shows inclus. Les autres sont payants.
 * Utilisée à l'identique par le navigateur (affichage) et le serveur (calcul qui fait foi).
 */
export function priceShows(chosen: { id: string; priceCents: number; categoryIds: string[] }[], categoryId: string, included: number) {
  const eligible = chosen.filter((s) => s.categoryIds.includes(categoryId)).sort((a, b) => b.priceCents - a.priceCents);
  const free = new Set(eligible.slice(0, included).map((s) => s.id));
  return chosen.map((s) => ({ id: s.id, included: free.has(s.id), priceCents: free.has(s.id) ? 0 : s.priceCents }));
}

export const depositCents = (totalCents: number, pct: number) => Math.ceil((totalCents * pct) / 100);

/**
 * Options liées aux bouteilles (« couronne de 3 Moët ») : un show avec `minBottles > 0`
 * n'est proposé que si le client a commandé assez de bouteilles.
 * `bottleId` à null = n'importe quelle bouteille du panier.
 */
export function bottleOptionUnlocked(
  option: { minBottles: number; bottleId: string | null },
  lines: { bottleId: string; quantity: number }[],
) {
  if (option.minBottles <= 0) return true;
  const count = lines.filter((l) => !option.bottleId || l.bottleId === option.bottleId).reduce((a, l) => a + l.quantity, 0);
  return count >= option.minBottles;
}

/** Nombre total de bouteilles d'un panier. */
export const bottleCount = (lines: { quantity: number }[]) => lines.reduce((a, l) => a + l.quantity, 0);
