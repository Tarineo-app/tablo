import { db } from "@/lib/db";
import { readTheme, themeVars } from "@/lib/theme";

/** Couleurs du bouton flottant, lues par embed.js. */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("v") ?? "";
  const venue = await db.venue.findUnique({ where: { slug }, select: { theme: true, kind: true } });
  const headers = { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" };
  if (!venue) return Response.json({}, { status: 404, headers });
  const t = readTheme(venue.theme, venue.kind);
  const v = themeVars(t);
  return Response.json({ fab: t.fab, btn: v["--w-fab"], on: v["--w-fab-on"], radius: v["--w-radius"] }, { headers });
}
