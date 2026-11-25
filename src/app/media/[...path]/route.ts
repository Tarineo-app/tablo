import { MEDIA_TYPES, readMedia } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ path: string[] }> };

/** Sert une photo du bucket privé. Le nom est l'empreinte du contenu : on peut la garder en cache pour toujours. */
export async function GET(_req: Request, { params }: Ctx) {
  const { path } = await params;
  const p = path.join("/");
  const m = /^[a-z0-9]+\/[a-f0-9]{64}\.(jpg|png|webp|svg)$/.exec(p);
  if (!m) return new Response("Introuvable", { status: 404 });
  const bytes = await readMedia(p);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MEDIA_TYPES[m[1]],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Un SVG ouvert directement ne doit rien pouvoir exécuter.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
