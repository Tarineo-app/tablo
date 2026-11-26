import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Decor from "@/app/w/Decor";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import { readTheme, themeVars } from "@/lib/theme";
import { tierLabel } from "@/lib/tickets";
import Resale from "./Resale";
import "../../../widget.css";

type Props = { params: Promise<{ slug: string; token: string }> };

export const metadata = { title: "Votre billet" };

export default async function Page({ params }: Props) {
  const { slug, token } = await params;
  const t = await db.ticket.findUnique({ where: { qrToken: token }, include: { venue: true, event: true, tier: true } });
  if (!t || t.venue.slug !== slug) notFound();
  const theme = readTheme(t.venue.theme, t.venue.kind);
  const qr = await QRCode.toDataURL(token, { margin: 1, width: 300 });
  const date = t.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return (
    <main className="w" style={{ ...(themeVars(theme) as React.CSSProperties), gridTemplateColumns: "1fr", placeItems: "start center" }}>
      <Decor layers={theme.layers} />
      <section className="w-main" style={{ maxWidth: 620, width: "100%" }}>
        {theme.logoUrl ? <img className="w-logo" src={theme.logoUrl} alt={t.venue.name} /> : <span className="w-brand">{t.venue.name}</span>}
        <h1 className="w-title">À ce soir, {t.buyerName.split(" ")[0]} !</h1>
        <p className="w-sub" style={{ textTransform: "none" }}>{date}{t.event.name ? ` · ${t.event.name}` : ""} · {t.quantity} entrée{t.quantity > 1 ? "s" : ""}</p>
        <div className="w-card" style={{ display: "grid", placeItems: "center", gap: 8, background: "#fff", color: "#111" }}>
          <img src={qr} alt="QR code d'entrée" width={200} height={200} />
          <b style={{ fontSize: 22, letterSpacing: ".18em" }}>{token}</b>
          <span style={{ fontSize: 13 }}>À présenter à l&apos;entrée, une seule fois pour tout le groupe</span>
        </div>
        <div className="w-card" style={{ display: "grid", gap: 8 }}>
          <div className="w-line"><span>{t.quantity} × {t.tier.name}</span><b>{eur(t.totalCents)}</b></div>
          <div className="w-line"><span>Conditions</span><b>{tierLabel(t.tier)}</b></div>
        </div>
        {["PENDING", "PAID"].includes(t.status) && (
          <Resale token={token} transfer={t.venue.ticketTransfer} buyback={t.venue.ticketBuyback} hours={t.venue.ticketBuybackHours} pct={t.venue.ticketBuybackPct} />
        )}
        {t.status === "TRANSFERRED" && <div className="w-card w-rules">Ce billet a été donné à quelqu&apos;un d&apos;autre : ce code ne fonctionne plus.</div>}
        {t.status === "RETURNED" && <div className="w-card w-rules">Ce billet a été rendu au club. La place est remise en vente.</div>}
        {t.status === "PENDING" && <div className="w-card w-rules">Le paiement en ligne arrive très bientôt. En attendant, votre place est notée et le club vous confirme le règlement.</div>}
        <p className="w-legal">Passé l&apos;heure indiquée, le billet n&apos;est plus valable à ce tarif. Entrée sous réserve de l&apos;accord de la sécurité. L&apos;abus d&apos;alcool est dangereux pour la santé.</p>
      </section>
    </main>
  );
}
