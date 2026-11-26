/**
 * Détourage automatique dans le navigateur, sans service extérieur.
 * Principe : on repère la couleur du fond sur les bords de l'image, puis on efface tout ce qui y ressemble
 * et qui touche le bord (remplissage depuis les bords), avec un bord adouci.
 * Marche très bien pour un logo, une bouteille ou un objet photographié sur un fond uni ;
 * sur une photo au décor chargé, on garde l'image telle quelle et on le dit.
 */
export type CutoutResult = { url: string; removed: boolean; note?: string };

const MAX_SIDE = 1000;
const MAX_CHARS = 700_000;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("IMAGE")); };
    img.src = url;
  });
}

function encode(c: HTMLCanvasElement): string {
  const webp = c.toDataURL("image/webp", 0.86);
  const png = c.toDataURL("image/png");
  return webp.startsWith("data:image/webp") && webp.length < png.length ? webp : png;
}

/** Réduit jusqu'à tenir dans la taille maximale enregistrable. */
function fit(c: HTMLCanvasElement, max = MAX_CHARS): string {
  let url = encode(c);
  let cur = c;
  while (url.length > max && cur.width > 240) {
    const n = document.createElement("canvas");
    n.width = Math.round(cur.width * 0.8); n.height = Math.round(cur.height * 0.8);
    n.getContext("2d")!.drawImage(cur, 0, 0, n.width, n.height);
    cur = n; url = encode(cur);
  }
  return url;
}

export async function cutout(file: File, opts: { remove: boolean; tolerance?: number; maxSide?: number; maxChars?: number } = { remove: true }): Promise<CutoutResult> {
  const img = await load(file);
  const k = Math.min(1, (opts.maxSide ?? MAX_SIDE) / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  if (!opts.remove) return { url: fit(c, opts.maxChars), removed: false };

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const at = (x: number, y: number) => (y * w + x) * 4;

  // Déjà transparente sur les bords : rien à faire.
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  if (corners.filter((i) => px[i + 3] < 200).length >= 2) return { url: fit(c), removed: false, note: "Image déjà détourée." };

  // Couleur du fond : la plus fréquente sur le pourtour (couleurs regroupées par paquets de 16).
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(at(x, 0), at(x, h - 1));
  for (let y = 1; y < h - 1; y++) border.push(at(0, y), at(w - 1, y));
  for (const i of border) {
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2];
    counts.set(key, e);
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!top || top.n / border.length < 0.35) {
    return { url: fit(c), removed: false, note: "Le fond de cette image n'est pas uni : elle est gardée telle quelle. Une image sur fond uni (ou un PNG transparent) se détoure toute seule." };
  }
  const bg = [top.r / top.n, top.g / top.n, top.b / top.n];
  const tol = opts.tolerance ?? 42;
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);

  // Remplissage depuis les bords.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const i of border) { const p = i / 4; if (!seen[p] && dist(i) < tol) { seen[p] = 1; stack.push(p); } }
  let gone = 0;
  while (stack.length) {
    const p = stack.pop()!;
    px[p * 4 + 3] = 0; gone++;
    const x = p % w, y = (p / w) | 0;
    const near = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of near) if (q >= 0 && !seen[q] && dist(q * 4) < tol) { seen[q] = 1; stack.push(q); }
  }
  const share = gone / (w * h);
  if (share < 0.02 || share > 0.97) {
    ctx.drawImage(img, 0, 0, w, h);
    return { url: fit(c), removed: false, note: "Impossible de distinguer le sujet du fond : l'image est gardée telle quelle." };
  }
  // Bord adouci : les pixels qui touchent le fond effacé et lui ressemblent un peu deviennent semi-transparents.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (seen[p]) continue;
    if (seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w]) {
      const d = dist(p * 4);
      px[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0.25, (d - tol) / (tol * 1.4))));
    }
  }
  ctx.putImageData(data, 0, 0);
  return { url: fit(c), removed: true };
}
