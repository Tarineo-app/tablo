import "server-only";
import { createHash } from "node:crypto";

/**
 * Photos (plan, carrés, logo) dans Supabase Storage, bucket privé, chemins préfixés par l'établissement.
 * On les sert nous-mêmes par /media/… : l'adresse ne change jamais (nom = empreinte du contenu),
 * donc elle se met en cache pour toujours.
 * Sans SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, on garde l'image dans la base comme avant.
 */
const BUCKET = process.env.SUPABASE_BUCKET || "tablo";
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" };
export const MEDIA_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" };

export const storageReady = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = () => process.env.SUPABASE_URL!.replace(/\/$/, "");
const auth = () => ({ Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! });

/** Une image acceptée : adresse https, ou fichier déjà rangé chez nous, ou image envoyée par le navigateur. */
export const isImageValue = (v: string, svg = false) =>
  /^https:\/\//.test(v) || /^\/media\/[a-z0-9]+\/[a-f0-9]{64}\.(jpg|png|webp|svg)$/.test(v) ||
  new RegExp(`^data:image/(png|jpeg|webp${svg ? "|svg\\+xml" : ""});base64,`).test(v);

async function ensureBucket() {
  await fetch(`${base()}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_BYTES, allowed_mime_types: Object.keys(TYPES) }),
  }).catch(() => null);
}

/**
 * Range une image envoyée par le navigateur et renvoie son adresse /media/…
 * Toute autre valeur (https, /media déjà rangée, vide) est rendue telle quelle.
 */
export async function persistImage(venueId: string, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const m = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,(.+)$/.exec(value);
  if (!m || !storageReady()) return value;
  const type = m[1];
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("IMAGE_TOO_BIG");
  const path = `${venueId.toLowerCase()}/${createHash("sha256").update(bytes).digest("hex")}.${TYPES[type]}`;
  const put = () =>
    fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": type, "x-upsert": "true", "Cache-Control": "31536000" },
      body: bytes,
    });
  let res = await put();
  if (res.status === 404 || res.status === 400) {
    // Premier envoi : le bucket n'existe pas encore, on le crée (privé) puis on réessaie.
    await ensureBucket();
    res = await put();
  }
  if (!res.ok) {
    console.error("[storage] envoi refusé", res.status, (await res.text()).slice(0, 200));
    return value; // on n'empêche pas l'enregistrement : l'image reste dans la base
  }
  return `/media/${path}`;
}

/** Lit un fichier rangé (pour la route /media). */
export async function readMedia(path: string) {
  if (!storageReady()) return null;
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, { headers: auth(), cache: "no-store" });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
