"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buyTickets } from "@/app/actions/tickets";
import { themeVars } from "@/lib/theme";
import { fmtTime } from "@/lib/tickets";
import type { WidgetData } from "@/lib/widget";
import ModeTabs from "../ModeTabs";

const eur = (c: number) => (c === 0 ? "Gratuit" : (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 }));
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });
const conso = (n: number) => (n === 0 ? "Sans conso" : n === 1 ? "1 conso incluse" : `${n} consos incluses`);

type Ev = WidgetData["events"][number];
const firstOpen = (e?: Ev) => e?.tiers.find((t) => !t.closed && t.left !== 0)?.id ?? null;

export default function Tickets({ data, managerCode }: { data: WidgetData; managerCode: string | null }) {
  const { venue } = data;
  const events = data.events.filter((e) => e.tiers.length > 0);
  const router = useRouter();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [tierId, setTierId] = useState<string | null>(firstOpen(events[0]));
  const [qty, setQty] = useState(2);
  const [who, setWho] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const event = events.find((e) => e.id === eventId);
  const tier = event?.tiers.find((t) => t.id === tierId);
  const max = Math.min(20, tier?.left ?? 20);
  const total = (tier?.priceCents ?? 0) * qty;
  const ready = !!tier && qty >= 1 && qty <= max && who.name.trim().length > 1 && /\S+@\S+\.\S+/.test(who.email);

  const submit = () => start(async () => {
    setError(undefined);
    const r = await buyTickets({ slug: venue.slug, eventId, tierId: tierId!, quantity: qty, name: who.name, email: who.email, phone: who.phone || null, managerCode });
    if ("error" in r) setError(r.error);
    else router.push(`/w/${venue.slug}/b/${r.token}`);
  });
  const label = pending ? "Envoi…" : tier ? `${total === 0 ? "Réserver" : "Payer"} ${qty} entrée${qty > 1 ? "s" : ""}${total ? ` · ${eur(total)}` : ""}` : "Choisissez un tarif";

  return (
    <div className="w" style={themeVars(venue.theme) as React.CSSProperties}>
      <section className="w-main">
        <div className="w-top">
          {venue.theme.logoUrl ? <img className="w-logo" src={venue.theme.logoUrl} alt={venue.name} /> : <span className="w-brand">{venue.name}</span>}
        </div>
        <ModeTabs slug={venue.slug} kind={venue.kind} current="ticket" managerCode={managerCode} />
        <h1 className="w-title">Prenez votre entrée</h1>
        <p className="w-sub">Plus vous arrivez tôt, moins c&apos;est cher. Votre billet est un QR code à présenter à l&apos;entrée.</p>

        {events.length === 0 ? <p className="w-sub">Aucune soirée en billetterie pour le moment.</p> : (
          <>
            <h2 style={{ fontSize: 16 }}>Soirée</h2>
            <div className="w-dates">
              {events.map((e) => <button key={e.id} className={`w-opt ${e.id === eventId ? "on" : ""}`} onClick={() => { setEventId(e.id); setTierId(firstOpen(e)); }}><b>{day(e.date)}</b><small>{e.name || "Soirée"}</small></button>)}
            </div>

            <h2 style={{ fontSize: 16 }}>Tarif</h2>
            <div className="w-tiers">
              {event?.tiers.map((t) => {
                const off = t.closed || t.left === 0;
                return (
                  <button key={t.id} className={`w-tier ${t.id === tierId ? "on" : ""}`} disabled={off} onClick={() => { setTierId(t.id); if (t.left !== null) setQty((q) => Math.max(1, Math.min(q, t.left!))); }}>
                    <span className="h">{t.untilTime ? <>avant<b>{fmtTime(t.untilTime)}</b></> : <>toute<b>la nuit</b></>}</span>
                    <span className="n">{t.name}<small>{conso(t.drinks)}{t.left !== null && t.left > 0 && t.left <= 30 ? ` · plus que ${t.left} places` : ""}</small></span>
                    <span className="p">{t.closed ? <span className="w-badge" style={{ opacity: .7 }}>Terminé</span> : t.left === 0 ? <span className="w-badge" style={{ opacity: .7 }}>Complet</span> : <b>{eur(t.priceCents)}</b>}</span>
                  </button>
                );
              })}
            </div>

            <h2 style={{ fontSize: 16 }}>Nombre d&apos;entrées</h2>
            <div className="w-qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins">−</button><b>{qty}</b><button onClick={() => setQty(Math.min(max, qty + 1))} aria-label="Plus">+</button></div>

            <div className="w-card" style={{ display: "grid", gap: 12 }}>
              <label className="w-field">Nom et prénom<input className="w-input" autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} /></label>
              <label className="w-field">Email (pour recevoir le billet)<input className="w-input" type="email" autoComplete="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} /></label>
              <label className="w-field">Téléphone (facultatif)<input className="w-input" type="tel" autoComplete="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} /></label>
            </div>
            {error && <p className="w-err" role="alert">{error}</p>}
            <div className="row"><button className="w-btn w-cta" disabled={!ready || pending} onClick={submit}>{label}</button></div>
          </>
        )}
      </section>

      <aside className="w-aside" aria-label="Votre commande">
        <h2 style={{ fontSize: 18 }}>Votre entrée</h2>
        {event && <div className="w-line"><span>{day(event.date)}</span><b>{event.name || "Soirée"}</b></div>}
        {tier && <div className="w-line"><span>{qty} × {tier.name}</span><b>{eur(tier.priceCents * qty)}</b></div>}
        {tier && <div className="w-line"><span>{tier.untilTime ? `Arrivée avant ${fmtTime(tier.untilTime)}` : "Arrivée à toute heure"}</span><b>{conso(tier.drinks)}</b></div>}
        <div className="w-total"><span>Total</span><span>{tier ? eur(total) : "—"}</span></div>
        <p className="w-legal">Passé l&apos;heure indiquée, le billet n&apos;est plus valable à ce tarif. Entrée réservée aux 18 ans et plus, sous réserve de l&apos;accord de la sécurité. L&apos;abus d&apos;alcool est dangereux pour la santé. Propulsé par Tablo.</p>
      </aside>

      <div className="w-foot"><span><b>{tier ? eur(total) : "—"}</b></span>
        <button className="w-btn" style={{ minHeight: 46 }} disabled={!ready || pending} onClick={submit}>{pending ? "Envoi…" : total === 0 ? "Réserver" : "Payer"}</button></div>
    </div>
  );
}
