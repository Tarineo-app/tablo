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
