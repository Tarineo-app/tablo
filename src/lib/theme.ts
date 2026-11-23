// Ambiances et thème du widget. Partagé entre le serveur et le navigateur.

export type Theme = {
  amb: string;
  accent: string;
  grad: "" | "holo" | "gold" | "disco" | "sun";
  mode: "dark" | "navy" | "jungle" | "disco" | "light" | "beach";
  font: string;
  head: string;
  btn: "round" | "pill" | "square";
  fab: string;
  logoUrl?: string | null;
};

export const AMBIANCES: Record<string, Omit<Theme, "fab" | "logoUrl"> & { name: string; desc: string; swatch: string }> = {
  tablo: { amb: "tablo", name: "Tablo", desc: "Noir, chrome, arc-en-ciel", accent: "#ffffff", grad: "holo", mode: "dark", font: "Manrope", head: "Unbounded", btn: "pill", swatch: "#060607" },
  masque: { amb: "masque", name: "Bal masqué", desc: "Bleu nuit et or", accent: "#e2b860", grad: "gold", mode: "navy", font: "Manrope", head: "Cinzel", btn: "square", swatch: "radial-gradient(circle at 50% 0%,#283080,#0c0f33)" },
  jungle: { amb: "jungle", name: "Jungle", desc: "Vert profond, néon", accent: "#7dffa8", grad: "", mode: "jungle", font: "Manrope", head: "Fraunces", btn: "pill", swatch: "radial-gradient(circle at 30% 0%,#0f5a36,#04170e)" },
  disco: { amb: "disco", name: "Disco", desc: "Violet, rose, paillettes", accent: "#ff5fa2", grad: "disco", mode: "disco", font: "Manrope", head: "Monoton", btn: "round", swatch: "radial-gradient(circle at 50% 0%,#3b1d6e,#0b0716)" },
  pool: { amb: "pool", name: "Pool party", desc: "Soleil et turquoise", accent: "#0fa3b1", grad: "sun", mode: "beach", font: "Manrope", head: "Bungee", btn: "round", swatch: "linear-gradient(180deg,#ffb45f,#ff7aa8 50%,#2bd4c4)" },
  chic: { amb: "chic", name: "Chic clair", desc: "Blanc cassé, noir", accent: "#16141a", grad: "", mode: "light", font: "Inter", head: "Playfair Display", btn: "square", swatch: "#f6f5f2" },
};

export const MODES: Record<Theme["mode"], { label: string; bg: string; panel: string; panel2: string; line: string; ink: string; mute: string }> = {
  dark: { label: "Noir", bg: "#060607", panel: "#121216", panel2: "#19191e", line: "#26262d", ink: "#f3f2f7", mute: "#8e8c99" },
  navy: { label: "Bleu nuit", bg: "#0b1020", panel: "#0f1338", panel2: "#171d4a", line: "#2a3270", ink: "#eef1fb", mute: "#9aa3c4" },
  jungle: { label: "Vert", bg: "#04170e", panel: "#071f14", panel2: "#0c2c1d", line: "#174a31", ink: "#e6fff0", mute: "#8fbfa2" },
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
export const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800;900&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;600;800&family=Montserrat:wght@500;700;800&family=Playfair+Display:wght@600;700&family=Cinzel:wght@600;700&family=Fraunces:ital,wght@1,600;1,800&family=Monoton&family=Bungee&display=swap";

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

/** Variables CSS appliquées au widget. */
export function themeVars(t: Theme): Record<string, string> {
  const m = MODES[t.mode] ?? MODES.dark;
  const grad = t.grad ? GRADIENTS[t.grad]?.css : "";
  const onAccent = t.grad === "holo" || t.grad === "gold" || luminance(t.accent) > 0.6 ? "#111111" : "#ffffff";
  return {
    "--w-bg": m.bg,
    "--w-panel": m.panel,
    "--w-panel2": m.panel2,
    "--w-line": m.line,
    "--w-ink": m.ink,
    "--w-mute": m.mute,
    "--w-accent": t.accent,
    "--w-btn": grad || t.accent,
    "--w-on": onAccent,
    "--w-radius": { round: "14px", pill: "999px", square: "3px" }[t.btn] ?? "14px",
    "--w-font": `'${t.font}', system-ui, sans-serif`,
    "--w-head": `'${t.head}', system-ui, sans-serif`,
  };
}
