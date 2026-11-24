import "server-only";

/** Un envoi porte des bouteilles et, depuis la recommande en soirée, des shows. */
export type AnyOrderItem = {
  quantity: number;
  flavor: string | null;
  bottleSize: { label: string; bottle: { name: string } } | null;
  show: { name: string } | null;
};

/** Le libellé affiché au serveur, au bar et au client. */
export function itemLabel(it: AnyOrderItem) {
  if (it.bottleSize) return `${it.bottleSize.bottle.name} ${it.bottleSize.label}${it.flavor ? ` · ${it.flavor}` : ""}`;
  return it.show?.name ?? "Article";
}
