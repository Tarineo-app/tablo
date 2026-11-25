import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { itemLabel } from "@/lib/orderitem";
import Reorder from "./Reorder";
import { eur } from "@/lib/money";
import { readTheme, themeVars } from "@/lib/theme";
import { paymentsReady } from "@/lib/stripe";
import { emailConfigured } from "@/lib/email";
import { now } from "@/lib/dates";
import "../../../widget.css";

type Props = { params: Promise<{ slug: string; token: string }>; searchParams: Promise<{ paiement?: string }> };

const PAY_MSG: Record<string, string> = {
  annule: "Paiement interrompu. Votre carré reste tenu quelques minutes : vous pouvez reprendre.",
  pris: "Désolé, ce carré a été pris pendant le paiement. Aucun montant n'a été prélevé. Choisissez-en un autre.",
  fermee: "Les réservations sont fermées pour cette soirée.",
  indisponible: "Le paiement en ligne n'est pas disponible pour le moment. Le club va vous contacter.",
  stripe: "Le paiement n'a pas pu s'ouvrir. Réessayez dans un instant.",
  patience: "Trop de tentatives. Réessayez dans quelques minutes.",
  annulee: "Cette réservation est annulée.",
};

export const metadata = { title: "Réservation enregistrée" };

export default async function Page({ params, searchParams }: Props) {
  const { slug, token } = await params;
  const { paiement } = await searchParams;
  const r = await db.reservation.findUnique({
    where: { qrToken: token },
    include: {
      venue: true, table: { include: { category: true } }, event: true,
      shows: { include: { show: true } },
      garageItem: { include: { bottleSize: { include: { bottle: true } } } },
      orders: { where: { number: 1 }, include: { items: { include: { bottleSize: { include: { bottle: true } }, show: true } } } },
    },
  });
  if (!r || r.venue.slug !== slug) notFound();

  // Carte du soir : ce que le client peut encore commander depuis sa table.
  const [bottles, shows] = await Promise.all([
    db.bottle.findMany({ where: { venueId: r.venueId, active: true }, orderBy: { name: "asc" }, include: { sizes: { orderBy: { priceCents: "asc" } } } }),
    db.show.findMany({ where: { venueId: r.venueId, active: true, isSign: false, minBottles: 0 }, orderBy: { priceCents: "asc" }, select: { id: true, name: true, priceCents: true } }),
  ]);
  const options = [
    ...bottles.flatMap((b) => b.sizes.map((z) => ({ id: z.id, label: `${b.name} ${z.label}`, priceCents: z.priceCents, kind: "bottle" as const, flavors: b.flavors }))),
    ...shows.map((sh) => ({ id: sh.id, label: sh.name, priceCents: sh.priceCents, kind: "show" as const, flavors: [] as string[] })),
  ];
  const theme = readTheme(r.venue.theme, r.venue.kind);
  const qr = await QRCode.toDataURL(token, { margin: 1, width: 300 });
  // Où en est le paiement ?
  const online = paymentsReady(r.venue);
  const paid = ["CONFIRMED", "FULLY_PAID", "CHECKED_IN", "COMPLETED"].includes(r.status);
  const awaiting = online && (r.status === "PENDING_PAYMENT" || r.status === "DRAFT") && r.depositCents > 0;
  const holdLeft = r.holdUntil ? r.holdUntil.getTime() - now().getTime() : 0;
  const holdTime = r.holdUntil?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  const showQr = !awaiting && r.status !== "CANCELLED";
  const label = r.payMode === "FULL" || r.depositCents >= r.totalCents ? "Payer" : "Payer l'acompte";
  const payBox = r.status === "CANCELLED" ? (
    <div className="w-card w-rules">{PAY_MSG[paiement ?? ""] ?? "Cette réservation est annulée."}</div>
  ) : awaiting && paiement === "ok" ? (
    <div className="w-card w-paywait">
      {/* Stripe nous confirme le paiement dans les secondes qui suivent : la page se recharge seule. */}
      <meta httpEquiv="refresh" content="3" />
      <b>Paiement reçu, confirmation en cours…</b>
      <span>Votre QR code d&apos;entrée s&apos;affiche dans un instant.</span>
    </div>
  ) : awaiting ? (
    <form className="w-card w-paybox" method="post" action={`/w/${slug}/r/${token}/payer`} target="_top">
      {paiement && PAY_MSG[paiement] && <p className="w-err" role="alert">{PAY_MSG[paiement]}</p>}
      <div className="w-total"><span>{label}</span><span>{eur(r.depositCents)}</span></div>
      <button className="w-accept" type="submit">{label} · {eur(r.depositCents)}</button>
      <span className="w-paynote">
        {holdLeft > 60_000 ? `Votre carré est tenu jusqu'à ${holdTime}. ` : "Le délai est passé : votre carré sera repris s'il est encore libre. "}
        Paiement sécurisé par Stripe, versé directement au club.
      </span>
    </form>
  ) : paid && paiement === "ok" && r.paidCents > 0 ? (
    <div className="w-card w-paydone"><b>Paiement reçu, votre carré est confirmé.</b>{emailConfigured() && <span>Un email de confirmation vous a été envoyé.</span>}</div>
  ) : null;

  const date = r.event.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  return (
    <main className="w" style={{ ...(themeVars(theme) as React.CSSProperties), gridTemplateColumns: "1fr", placeItems: "start center" }}>
      <section className="w-main" style={{ maxWidth: 620, width: "100%" }}>
        {theme.logoUrl ? <img className="w-logo" src={theme.logoUrl} alt={r.venue.name} /> : <span className="w-brand">{r.venue.name}</span>}
        <h1 className="w-title">{awaiting ? "Plus qu'une étape" : r.status === "CANCELLED" ? "Réservation annulée" : `C'est noté, ${r.organizerName.split(" ")[0]} !`}</h1>
        <p className="w-sub" style={{ textTransform: "none" }}>{r.table.name} · {r.table.category.name} · {date} · {r.guests} personnes</p>
        {payBox}
        {showQr && (
          <div className="w-card" style={{ display: "grid", placeItems: "center", gap: 10, background: "#fff", color: "#111" }}>
            <img src={qr} alt="QR code d'entrée" width={200} height={200} />
            <span style={{ fontSize: 13 }}>QR code à présenter à l&apos;entrée</span>
          </div>
        )}
        <div className="w-card" style={{ display: "grid", gap: 8 }}>
          {r.orders[0]?.items.map((it) => (
            <div key={it.id} className="w-line"><span>{it.quantity} × {itemLabel(it)}{it.fromGarage ? " · de votre garage" : ""}</span><b>{it.fromGarage ? "Offerte" : eur(it.unitCents * it.quantity)}</b></div>
          ))}
          {r.shows.map((s) => <div key={s.id} className="w-line"><span>{s.show.name}{s.show.isSign && r.signText ? ` « ${r.signText} »` : ""}</span><b>{s.included ? "Offert" : eur(s.priceCents)}</b></div>)}
          <div className="w-total"><span>Total</span><span>{eur(r.totalCents)}</span></div>
          {r.paidCents > 0 ? (
            <>
              <div className="w-line"><span>Déjà payé</span><b>{eur(r.paidCents)}</b></div>
              {r.totalCents > r.paidCents && <div className="w-line"><span>Reste à régler au club</span><b>{eur(r.totalCents - r.paidCents)}</b></div>}
            </>
          ) : (
            <div className="w-line"><span>{r.payMode === "FULL" || r.depositCents >= r.totalCents ? "À régler" : "Acompte à régler"}</span><b>{eur(r.depositCents)}</b></div>
          )}
        </div>
        {r.garageItem && <div className="w-card w-rules">Votre bouteille gardée au club ({r.garageItem.bottleSize.bottle.name} {r.garageItem.bottleSize.label}) vous sera remontée avec votre première commande.</div>}
        {!online && r.status === "DRAFT" && <div className="w-card w-rules">Le club vous contacte au {r.organizerPhone} pour confirmer votre réservation et son règlement.</div>}
        {!awaiting && r.status !== "CANCELLED" && <Reorder token={token} options={options} hasManager={r.managerId !== null} />}

        <p className="w-legal">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
      </section>
    </main>
  );
}
