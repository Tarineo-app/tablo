/** Le mobilier dessiné sur un emplacement du plan (widget, « Ce soir », éditeur). Partagé serveur et navigateur. */
export type Kind = "carre" | "haute" | "cabana" | "bali";

export function kindOf(...names: (string | null | undefined)[]): Kind {
  const s = names.filter(Boolean).join(" ").toLowerCase();
  if (/caban|tente|pergola|paillote/.test(s)) return "cabana";
  if (/bali|daybed|\blit\b|transat|parasol|matelas/.test(s)) return "bali";
  if (/haute|mange|debout|high/.test(s)) return "haute";
  return "carre";
}

/** Mobilier d'un carré : celui choisi par le club pour la catégorie, sinon deviné d'après les noms. */
export function furnitureOf(cat: { name?: string | null; furniture?: string | null } | null | undefined, tableName?: string): Kind {
  const f = cat?.furniture;
  if (f === "carre" || f === "haute" || f === "cabana" || f === "bali") return f;
  return kindOf(cat?.name, tableName);
}

/** « Lounge 12 » → « L12 », « Carré VIP 3 » → « CV3 », « Impérial » → « Imp ». */
export function shortName(name: string): string {
  const n = name.trim();
  const m = n.match(/^(.*?)[\s-]*(\d+[a-z]?)$/i);
  if (m && m[1]) return m[1].split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") + m[2];
  if (m) return m[2];
  return n.length <= 4 ? n : n.slice(0, 3);
}
