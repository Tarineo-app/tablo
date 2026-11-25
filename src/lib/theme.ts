// Ambiances et thème du widget. Partagé entre le serveur et le navigateur.

export type Theme = {
  amb: string;
  accent: string;
  grad: "" | "holo" | "gold" | "disco" | "sun";
  mode: "dark" | "navy" | "velours" | "disco" | "light" | "beach";
  font: string;
  head: string;
  btn: "round" | "pill" | "square";
  fab: string;
  logoUrl?: string | null;
  /** Couleurs choisies partie par partie ; une partie absente suit l'ambiance. */
  colors?: Partial<Record<ColorKey, string>>;
};

/** Les parties du widget qu'un club peut colorer une à une. */
export const COLOR_PARTS = [
  { key: "title", label: "Titres", hint: "« Choisissez votre carré », « Vos bouteilles »…" },
  { key: "bg", label: "Fond", hint: "Le fond de toute la fenêtre" },
  { key: "panel", label: "Cartes et encadrés", hint: "Soirées, bouteilles, shows, récapitulatif" },
  { key: "ink", label: "Texte", hint: "Le texte courant (les textes secondaires suivent)" },
  { key: "btn1", label: "Boutons", hint: "« Continuer », « Ajouter », « Réserver »" },
  { key: "btn2", label: "Boutons, 2ᵉ couleur", hint: "Facultatif : fait un dégradé avec la couleur des boutons" },
  { key: "fab", label: "Bouton sur votre site", hint: "Le bouton flottant « Réserver » posé sur votre site" },
] as const;
export type ColorKey = (typeof COLOR_PARTS)[number]["key"];
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const AMBIANCES: Record<string, Omit<Theme, "fab" | "logoUrl"> & { name: string; desc: string; swatch: string }> = {
  tablo: { amb: "tablo", name: "Tablo", desc: "Noir, chrome, arc-en-ciel", accent: "#ffffff", grad: "holo", mode: "dark", font: "Manrope", head: "Unbounded", btn: "pill", swatch: "#060607" },
  or: { amb: "or", name: "Noir et or", desc: "Luxe, champagne, doré", accent: "#e2b860", grad: "gold", mode: "dark", font: "Manrope", head: "Cinzel", btn: "square", swatch: "radial-gradient(circle at 50% 0%,#4a3812,#060607 72%)" },
  velours: { amb: "velours", name: "Velours rouge", desc: "Bordeaux, rouge, lumière tamisée", accent: "#ff3b5c", grad: "", mode: "velours", font: "Manrope", head: "Playfair Display", btn: "pill", swatch: "radial-gradient(circle at 50% 0%,#7a1428,#14050a 75%)" },
  disco: { amb: "disco", name: "Disco", desc: "Violet, rose, paillettes", accent: "#ff5fa2", grad: "disco", mode: "disco", font: "Manrope", head: "Monoton", btn: "round", swatch: "radial-gradient(circle at 50% 0%,#3b1d6e,#0b0716)" },
  pool: { amb: "pool", name: "Pool party", desc: "Soleil et turquoise", accent: "#0fa3b1", grad: "sun", mode: "beach", font: "Manrope", head: "Bungee", btn: "round", swatch: "linear-gradient(180deg,#ffb45f,#ff7aa8 50%,#2bd4c4)" },
  chic: { amb: "chic", name: "Chic clair", desc: "Blanc cassé, noir", accent: "#16141a", grad: "", mode: "light", font: "Inter", head: "Playfair Display", btn: "square", swatch: "#f6f5f2" },
};

export const MODES: Record<Theme["mode"], { label: string; bg: string; panel: string; panel2: string; line: string; ink: string; mute: string }> = {
  dark: { label: "Noir", bg: "#060607", panel: "#121216", panel2: "#19191e", line: "#26262d", ink: "#f3f2f7", mute: "#8e8c99" },
  navy: { label: "Bleu nuit", bg: "#0b1020", panel: "#0f1338", panel2: "#171d4a", line: "#2a3270", ink: "#eef1fb", mute: "#9aa3c4" },
  velours: { label: "Bordeaux", bg: "#12050a", panel: "#1c0a12", panel2: "#2a0f1b", line: "#4a1a2c", ink: "#fff0f3", mute: "#c79aa8" },
  disco: { label: "Violet", bg: "#0b0716", panel: "#140c26", panel2: "#1d1236", line: "#36235c", ink: "#f6eeff", mute: "#b3a2d6" },
  light: { label: "Clair", bg: "#f6f5f2", panel: "#ffffff", panel2: "#f2f0ec", line: "#e3dfd7", ink: "#16141a", mute: "#6b6574" },
  beach: { label: "Plage", bg: "#fff6ec", panel: "#fffaf4", panel2: "#ffeedd", line: "#f3d9c2", ink: "#08202a", mute: "#5b6f78" },
};

export const GRADIENTS: Record<Exclude<Theme["grad"], "">, { label: string; css: string }> = {
  holo: { label: "Arc-en-ciel", css: "linear-gradient(110deg,#ff5fa2 0%,#a970ff 30%,#4fd8ff 60%,#b6ff6a 85%,#ff5fa2 100%)" },
  gold: { label: "Or", css: "linear-gradient(180deg,#f7dc95,#e2b860 55%,#a87a2c)" },
  disco: { label: "Disco", css: "linear-gradient(110deg,#ff5fa2,#a970ff,#4fd8ff,#ff5fa2)" },
  sun: { label: "Coucher de soleil", css: "linear-gradient(110deg,#ff8a5f,#ff5fa2 45%,#0fa3b1)" },
};

export const HEAD_FONTS = ["Unbounded", "Montserrat", "Playfair Display", "Cinzel", "Fraunces", "Monoton", "Bungee", "Inter"];
export const TEXT_FONTS = ["Manrope", "Inter", "Montserrat"];
/** Polices hébergées sur le site (public/fonts) : aucune adresse IP de visiteur n'est envoyée à Google. */
export const FONTS_URL = "/fonts/fonts.css";

export function defaultTheme(kind: string): Theme {
  const a = AMBIANCES[kind === "beach" ? "pool" : "tablo"];
  return { amb: a.amb, accent: a.accent, grad: a.grad, mode: a.mode, font: a.font, head: a.head, btn: a.btn, fab: kind === "beach" ? "Réserver un transat" : "Réserver un carré", logoUrl: null };
}

export function readTheme(raw: unknown, kind: string): Theme {
  const base = defaultTheme(kind);
  if (!raw || typeof raw !== "object") return base;
  return { ...base, ...(raw as Partial<Theme>) };
}

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mélange deux couleurs hexadécimales (t = part de b). */
function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
}
const onColor = (hex: string) => (luminance(hex) > 0.6 ? "#111111" : "#ffffff");

/** Variables CSS appliquées au widget. */
export function themeVars(t: Theme): Record<string, string> {
  const m = MODES[t.mode] ?? MODES.dark;
  const c = t.colors ?? {};
  const grad = t.grad ? GRADIENTS[t.grad]?.css : "";
  const onAccent = t.grad === "holo" || t.grad === "gold" || luminance(t.accent) > 0.6 ? "#111111" : "#ffffff";
  // Couleurs partie par partie : on recalcule les nuances voisines pour que tout reste lisible.
  const ink = isHex(c.ink) ? c.ink : m.ink;
  const bg = isHex(c.bg) ? c.bg : m.bg;
  const custom = isHex(c.bg) || isHex(c.panel) || isHex(c.ink);
  const panel = isHex(c.panel) ? c.panel : isHex(c.bg) ? mixHex(bg, ink, 0.06) : m.panel;
  const panel2 = custom ? mixHex(panel, ink, 0.05) : m.panel2;
  const line = custom ? mixHex(panel, ink, 0.15) : m.line;
  const mute = isHex(c.ink) || isHex(c.bg) ? mixHex(ink, bg, 0.42) : m.mute;
  // Boutons : une couleur, ou un dégradé (la 2ᵉ couleur seule part de la couleur principale).
  const b1 = isHex(c.btn1) ? c.btn1 : isHex(c.btn2) && isHex(t.accent) ? t.accent : null;
  const btn = b1 ? (isHex(c.btn2) ? `linear-gradient(110deg, ${b1}, ${c.btn2})` : b1) : grad || t.accent;
  const on = b1 ? onColor(isHex(c.btn2) ? mixHex(b1, c.btn2, 0.5) : b1) : onAccent;
  const fab = isHex(c.fab) ? c.fab : btn;
  return {
    "--w-bg": bg,
    "--w-panel": panel,
    "--w-panel2": panel2,
    "--w-line": line,
    "--w-ink": ink,
    "--w-mute": mute,
    "--w-accent": t.accent,
    "--w-title": isHex(c.title) ? c.title : t.accent,
    "--w-btn": btn,
    "--w-on": on,
    "--w-fab": fab,
    "--w-fab-on": isHex(c.fab) ? onColor(c.fab) : on,
    "--w-radius": { round: "14px", pill: "999px", square: "3px" }[t.btn] ?? "14px",
    "--w-font": `'${t.font}', system-ui, sans-serif`,
    "--w-head": `'${t.head}', system-ui, sans-serif`,
  };
}
