import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lineLabel, loadOffer } from "@/lib/offers";
import { eur } from "@/lib/money";
import { readTheme, themeVars } from "@/lib/theme";
import AcceptOffer from "./AcceptOffer";
import "../../w/widget.css";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await loadOffer((await params).code.toUpperCase());
  return { title: found ? `Votre proposition · ${found.offer.venue.name}` : "Proposition", robots: { index: false } };
}

const day = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default async function Page({ params }: Props) {
  const found = await loadOffer((await params).code.toUpperCase());
  if (!found) notFound();
  const { offer, expired } = found;
  const theme = readTheme(offer.venue.theme, offer.venue.kind);
  const manager = offer.manager?.user.name ?? "Votre contact";
  const saved = Math.max(0, offer.listCents - offer.priceCents);
  const closed = expired || offer.status !== "SENT";

  return (
    <main className="w" style={{ ...(themeVars(theme) as React.CSSProperties), gridTemplateColumns: "1fr", placeItems: "start center" }}>
      <section className="w-main" style={{ maxWidth: 620, width: "100%" }}>
        {theme.logoUrl ? <img className="w-logo" src={theme.logoUrl} alt={offer.venue.name} /> : <span className="w-brand">{offer.venue.name}</span>}

        {offer.status === "REQUESTED" ? (
          <>
            <h1 className="w-title">Votre demande est partie.</h1>
            <p className="w-sub" style={{ textTransform: "none" }}>{manager} prépare votre proposition et revient vers vous. Gardez ce lien : votre offre s&apos;affichera ici.</p>
          </>
        ) : (
          <>
            <h1 className="w-title">{manager} vous propose votre soirée.</h1>
            <p className="w-sub" style={{ textTransform: "none" }}>
              {day(offer.event.date)}{offer.event.name ? ` · ${offer.event.name}` : ""}
              {offer.table ? ` · ${offer.table.name} · ${offer.table.category.name}` : ""} · {offer.guests} personnes
            </p>
          </>
        )}

        {offer.message && (
          <div className="w-card w-note">
            <b>{manager}</b>
            <p>{offer.message}</p>
          </div>
        )}

        {offer.items.length > 0 && (
          <div className="w-card" style={{ display: "grid", gap: 8 }}>
            {offer.items.map((it) => (
              <div key={it.id} className="w-line">
                <span>{it.quantity > 1 ? `${it.quantity} × ` : ""}{lineLabel(it)}</span>
                <b>{it.offered ? <span className="w-gift">Offert</span> : eur(it.unitCents * it.quantity)}</b>
              </div>
            ))}
            {offer.signText && <div className="w-line"><span>Pancarte « {offer.signText} »</span><b><span className="w-gift">Offerte</span></b></div>}
          </div>
        )}

        {offer.status !== "REQUESTED" && (
          <div className="w-card w-price">
            {saved > 0 && (
              <div className="w-line">
                <span>Valeur à la carte</span>
                <b style={{ textDecoration: "line-through", color: "var(--w-mute)" }}>{eur(offer.listCents)}</b>
              </div>
            )}
            <div className="w-line w-total">
              <span>Votre prix</span>
              <b>{eur(offer.priceCents)}</b>
            </div>
            {saved > 0 && <p className="w-saved">{manager} vous offre {eur(saved)}.</p>}
          </div>
        )}

        {closed && offer.status !== "REQUESTED" ? (
          <p className="w-sub" style={{ textTransform: "none" }}>
            {offer.status === "ACCEPTED"
              ? "Cette proposition est déjà acceptée. À très vite."
              : expired
                ? "Cette proposition a expiré. Redemandez-en une à votre manager, il la refait en deux minutes."
                : "Cette proposition n'est plus valable."}
          </p>
        ) : offer.status === "SENT" ? (
          <AcceptOffer code={offer.code} slug={offer.venue.slug} payModes={offer.venue.payModes} priceCents={offer.priceCents} />
        ) : null}

        <p className="w-legal">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </section>
    </main>
  );
}
