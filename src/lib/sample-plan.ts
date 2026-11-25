import type { Box } from "@/app/w/[slug]/Plan3D";

/** Un petit plan d'exemple pour l'aperçu : il prend les couleurs et les polices choisies. */
export const samplePlan = (kind: string): Box[] => {
  const b = (id: string, name: string, x: number, y: number, w: number, h: number, color: string, k: Box["kind"], sub: string, taken = false): Box =>
    ({ id, name, sub, x, y, w, h, elevation: 2, color, photoUrl: null, taken, small: false, kind: k });
  return kind === "beach"
    ? [b("a", "Cabana 1", 6, 10, 20, 26, "#4fd8ff", "cabana", "min 600 €"), b("b", "Bali 1", 40, 14, 16, 22, "#ff8a5f", "bali", "min 400 €"), b("c", "Cabana 2", 72, 10, 20, 26, "#4fd8ff", "cabana", "", true), b("d", "Ponton", 34, 60, 32, 24, "#ffd25f", "carre", "min 1 200 €")]
    : [b("a", "Impérial", 6, 8, 24, 22, "#ffd25f", "carre", "min 1 500 €"), b("b", "Scène", 40, 8, 20, 22, "#ff5fa2", "carre", "", true), b("c", "Lounge 1", 70, 8, 22, 22, "#a970ff", "carre", "min 500 €"), b("d", "Haute 1", 22, 62, 12, 20, "#4fd8ff", "haute", "min 200 €"), b("e", "Lounge 2", 62, 58, 24, 24, "#a970ff", "carre", "min 500 €")];
};
