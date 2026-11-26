/**
 * Catalogue Tablo : les bouteilles les plus vendues en carré, préparées par Tablo (photo détourée, formats, prix conseillés).
 * Le club les ajoute à sa carte d'un « + », puis règle ses prix et son stock. Ses propres bouteilles restent possibles.
 * Pour ajouter une bouteille au catalogue : déposer l'image détourée dans public/bottles/ (webp ou png, fond transparent)
 * et ajouter une ligne ci-dessous. L'identifiant ne doit jamais changer (il relie les bouteilles des clubs au catalogue).
 */
export type CatalogBottle = {
  id: string;
  name: string;
  family: "Champagne" | "Vodka" | "Tequila" | "Whisky" | "Gin" | "Rhum" | "Cognac" | "Liqueur" | "Autre";
  type: string;
  description: string;
  image: string;
  flavors: string[];
  flavorImages?: Record<string, string>;
  /** Formats et prix conseillés, en centimes. */
  sizes: { label: string; volume: string; priceCents: number }[];
};

export const CATALOG: CatalogBottle[] = [
  {"id": "moet", "name": "Moët & Chandon Brut Impérial", "family": "Champagne", "type": "Champagne", "description": "Servi en seau lumineux avec sparkler.", "image": "/bottles/moet.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 18000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 39000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 90000}]},
  {"id": "ice", "name": "Moët & Chandon Ice Impérial", "family": "Champagne", "type": "Champagne à servir sur glace", "description": "Servi en grands verres sur glace, menthe et fruits.", "image": "/bottles/ice.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 22000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 48000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 110000}]},
  {"id": "armand", "name": "Armand de Brignac Brut Gold", "family": "Champagne", "type": "Champagne", "description": "Arrive dans la mallette lumineuse, sous fumée.", "image": "/bottles/armand.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 65000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 150000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 380000}, {"label": "Mathusalem", "volume": "6 L", "priceCents": 850000}]},
  {"id": "dom", "name": "Dom Pérignon Luminous", "family": "Champagne", "type": "Champagne millésimé", "description": "Étiquette lumineuse, arrivée en coffret avec la parade.", "image": "/bottles/dom.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 45000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 100000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 260000}]},
  {"id": "ruinart", "name": "Ruinart Blanc de Blancs", "family": "Champagne", "type": "Champagne blanc de blancs", "description": "Servi en seau à glace avec flûtes.", "image": "/bottles/ruinart.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 29000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 65000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 150000}]},
  {"id": "ruinr", "name": "R de Ruinart Brut", "family": "Champagne", "type": "Champagne brut", "description": "Servi en seau à glace avec flûtes.", "image": "/bottles/ruinr.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "75 cl", "priceCents": 22000}, {"label": "Magnum", "volume": "1,5 L", "priceCents": 49000}, {"label": "Jéroboam", "volume": "3 L", "priceCents": 110000}]},
  {"id": "clase", "name": "Clase Azul Reposado", "family": "Tequila", "type": "Tequila", "description": "Servie avec agrumes et sel fumé.", "image": "/bottles/clase.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 52000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 130000}]},
  {"id": "belv", "name": "Belvedere 10", "family": "Vodka", "type": "Vodka premium", "description": "Servie avec 4 softs premium au choix.", "image": "/bottles/belv.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 42000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 110000}]},
  {"id": "belvo", "name": "Belvedere Organic", "family": "Vodka", "type": "Vodka", "description": "Servie avec softs et bloc de glace.", "image": "/bottles/belvo.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 18000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 42000}, {"label": "3 litres", "volume": "3 L", "priceCents": 90000}, {"label": "6 litres", "volume": "6 L", "priceCents": 190000}]},
  {"id": "absolut", "name": "Absolut Vodka", "family": "Vodka", "type": "Vodka", "description": "Servie avec softs et jus au choix.", "image": "/bottles/absolut.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 12000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 26000}, {"label": "3 litres", "volume": "3 L", "priceCents": 45000}, {"label": "4,5 litres", "volume": "4,5 L", "priceCents": 65000}]},
  {"id": "ciroc", "name": "Cîroc", "family": "Vodka", "type": "Vodka aromatisée", "description": "Servie avec softs, jus et fruits frais assortis au goût.", "image": "/bottles/ciroc-0.webp", "flavors": ["Red Berry", "Peach", "Apple"], "flavorImages": {"Red Berry": "/bottles/ciroc-0.webp", "Peach": "/bottles/ciroc-1.webp", "Apple": "/bottles/ciroc-2.webp"}, "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 17000}, {"label": "1 litre", "volume": "1 L", "priceCents": 23000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 38000}]},
  {"id": "jager", "name": "Jägermeister", "family": "Liqueur", "type": "Liqueur aux plantes", "description": "Servi glacé, en shots ou avec Red Bull.", "image": "/bottles/jager.webp", "flavors": [], "sizes": [{"label": "Classique", "volume": "70 cl", "priceCents": 15000}, {"label": "1 litre", "volume": "1 L", "priceCents": 20000}, {"label": "Magnum", "volume": "1,75 L", "priceCents": 32000}, {"label": "3 litres", "volume": "3 L", "priceCents": 52000}]},
];

export const catalogById = (id: string | null | undefined) => CATALOG.find((b) => b.id === id);
export const FAMILIES = [...new Set(CATALOG.map((b) => b.family))];
