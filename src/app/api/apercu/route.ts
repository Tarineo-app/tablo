import { NextRequest, NextResponse } from "next/server";
import { callerIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Hôtes qu'on refuse d'aller chercher : réseau interne, machine locale, adresses brutes. */
function publicHost(h: string) {
  const host = h.toLowerCase();
  if (!host.includes(".")) return false;
  if (/^(localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/.test(host)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // pas d'IP en clair
  if (host.includes(":")) return false; // pas d'IPv6
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host);
}

const pick = (html: string, re: RegExp) => html.match(re)?.[1]?.trim();
const decode = (v: string) =>
  v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i");
  const v = pick(html, re) ?? pick(html, alt);
  return v ? decode(v) : undefined;
}

export async function POST(req: NextRequest) {
  if (!rateLimit("apercu", await callerIp(), 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Trop de demandes, réessayez dans quelques minutes." }, { status: 429 });
  }
  const raw = String(((await req.json().catch(() => ({}))) as { url?: string }).url ?? "").trim();
  if (!raw || raw.length > 300) return NextResponse.json({ error: "Adresse manquante." }, { status: 400 });

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "Cette adresse n'a pas l'air valide." }, { status: 400 });
  }
  u.protocol = "https:";
  u.hash = "";
  if (!publicHost(u.hostname)) return NextResponse.json({ error: "Cette adresse n'a pas l'air valide." }, { status: 400 });

  const fallback = { host: u.hostname.replace(/^www\./, ""), url: u.origin };
  try {
    const ctrl = new AbortController();
    const stop = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; TabloPreview/1.0; +https://tablo.app)", accept: "text/html" },
    });
    clearTimeout(stop);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return NextResponse.json(fallback);

    const html = (await res.text()).slice(0, 400_000);
    const abs = (v?: string) => {
      if (!v) return undefined;
      try { const a = new URL(v, res.url); return a.protocol === "https:" ? a.toString() : undefined; } catch { return undefined; }
    };
    return NextResponse.json({
      ...fallback,
      title: meta(html, "og:site_name") ?? (pick(html, /<title[^>]*>([^<]{1,120})<\/title>/i) ? decode(pick(html, /<title[^>]*>([^<]{1,120})<\/title>/i)!) : undefined),
      tagline: meta(html, "og:description") ?? meta(html, "description"),
      image: abs(meta(html, "og:image")),
      themeColor: meta(html, "theme-color"),
      icon: abs(pick(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)),
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
