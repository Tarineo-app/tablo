import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import { readTheme, themeVars } from "@/lib/theme";
import "../../../widget.css";

type Props = { params: Promise<{ slug: string; token: string }> };

export const metadata = { title: "Réservation enregistrée" };

export default async function Page({ params }: Props) {
  const { slug, token } = await params;
  const r = await db.reservation.findUnique({
    where: { qrToken: token },
    include: {
      venue: true, table: { include: { category: true } }, event: true,
      shows: { include: { show: true } },
      orders: { where: { number: 1 }, include: { items: { include: { bottleSize: { include: { bottle: true } } } } } },
    },
  });
  if (!r || r.venue.slug !== slug) notFound();
  const theme = readTheme(r.venue.theme, r.venue.kind);
  const qr = await QRCode.toDataURL(token, { margin: 1, width: 300 });
  const date = r.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return (
    <main className="w" style={{ ...(themeVars(theme) as React.CSSProperties), gridTemplateColumns: "1fr", placeItems: "start center" }}>
      <section className="w-main" style={{ maxWidth: 620, width: "100%" }}>
        {theme.logoUrl ? <img className="w-logo" src={theme.logoUrl} alt={r.venue.name} /> : <span className="w-brand">{r.venue.name}</span>}
        <h1 className="w-title">C&apos;est noté, {r.organizerName.split(" ")[0]} !</h1>
        <p className="w-sub" style={{ textTransform: "none" }}>{r.table.name} · {r.table.category.name} · {date} · {r.guests} personnes</p>
        <div className="w-card" style={{ display: "grid", placeItems: "center", gap: 10, background: "#fff", color: "#111" }}>
          <img src={qr} alt="QR code d'entrée" width={200} height={200} />
          <span style={{ fontSize: 13 }}>QR code à présenter à l&apos;entrée</span>
        </div>
        <div className="w-card" style={{ display: "grid", gap: 8 }}>
          {r.orders[0]?.items.map((it) => (
            <div key={it.id} className="w-line"><span>{it.quantity} × {it.bottleSize.bottle.name} {it.bottleSize.label}{it.flavor ? ` · ${it.flavor}` : ""}</span><b>{eur(it.unitCents * it.quantity)}</b></div>
          ))}
          {r.shows.map((s) => <div key={s.id} className="w-line"><span>{s.show.name}{s.show.isSign && r.signText ? ` « ${r.signText} »` : ""}</span><b>{s.included ? "Offert" : eur(s.priceCents)}</b></div>)}
          <div className="w-total"><span>Total</span><span>{eur(r.totalCents)}</span></div>
          <div className="w-line"><span>{r.payMode === "FULL" ? "À régler" : "Acompte à régler"}</span><b>{eur(r.depositCents)}</b></div>
        </div>
        <div className="w-card w-rules">Le paiement en ligne de l&apos;acompte arrive très bientôt. En attendant, le club vous contacte au {r.organizerPhone} pour confirmer votre réservation.</div>
        <p className="w-legal">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </section>
    </main>
  );
}
