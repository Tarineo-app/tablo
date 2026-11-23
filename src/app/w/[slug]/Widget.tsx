"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReservation } from "@/app/actions/reserve";
import { depositCents, priceShows } from "@/lib/pricing";
import { themeVars } from "@/lib/theme";
import type { WidgetData } from "@/lib/widget";

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 });
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });
const STEPS = ["Soirée", "Carré", "Bouteilles", "Pancarte et shows", "Coordonnées"];
const PAY: Record<string, [string, string]> = { FULL: ["Tout payer", "Vous réglez la totalité maintenant."], POOL: ["Cagnotte", "Vous payez l'acompte, vos amis complètent."], CASH: ["Espèces", "Acompte en ligne, le reste sur place."] };

type Line = { sizeId: string; flavor: string | null; quantity: number };

export default function Widget({ data, managerCode }: { data: WidgetData; managerCode: string | null }) {
  const { venue, categories, tables, bottles, shows, events } = data;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [guests, setGuests] = useState(6);
  const [tableId, setTableId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [pickSize, setPickSize] = useState<Record<string, string>>({});
  const [pickFlavor, setPickFlavor] = useState<Record<string, string>>({});
  const [showIds, setShowIds] = useState<string[]>([]);
  const [signText, setSignText] = useState("");
  const [payMode, setPayMode] = useState<"FULL" | "POOL" | "CASH">((venue.payModes[0] as "FULL") ?? "FULL");
  const [who, setWho] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const event = events.find((e) => e.id === eventId);
  const table = tables.find((t) => t.id === tableId);
  const cat = categories.find((c) => c.id === table?.categoryId);
  const minCents = table ? (event?.prices[table.id] ?? table.minSpendCents) : 0;
  const sizeIndex = useMemo(() => new Map(bottles.flatMap((b) => b.sizes.map((s) => [s.id, { b, s }] as const))), [bottles]);
  const bottleLines = Object.values(lines).map((l) => ({ ...l, ...sizeIndex.get(l.sizeId)! })).filter((l) => l.s);
  const bottlesCents = bottleLines.reduce((a, l) => a + l.s.priceCents * l.quantity, 0);
  const sign = shows.find((s) => s.isSign);
  const chosen = shows.filter((s) => showIds.includes(s.id));
  const priced = table ? priceShows(chosen, table.categoryId, cat?.includedShows ?? 0) : [];
  const showsCents = priced.reduce((a, s) => a + s.priceCents, 0);
  const total = bottlesCents + showsCents;
  const deposit = payMode === "FULL" ? total : depositCents(total, cat?.depositPct ?? 0);
  const freeLeft = Math.max(0, (cat?.includedShows ?? 0) - priced.filter((p) => p.included).length);

  const canNext = [
    !!event && guests > 0,
    !!table && guests <= (table?.capacity ?? 0),
    bottlesCents >= minCents && bottleLines.length > 0,
    true,
    who.name.trim().length > 1 && /\S+@\S+\.\S+/.test(who.email) && who.phone.trim().length >= 6,
  ][step];

  const addLine = (bottleId: string) => {
    const b = bottles.find((x) => x.id === bottleId)!;
    const sizeId = pickSize[bottleId] ?? b.sizes.find((s) => !s.soldOut)?.id;
    if (!sizeId) return;
    const flavor = b.flavors.length ? (pickFlavor[bottleId] ?? b.flavors[0]) : null;
    const key = `${sizeId}|${flavor ?? ""}`;
    setLines((ls) => ({ ...ls, [key]: { sizeId, flavor, quantity: (ls[key]?.quantity ?? 0) + 1 } }));
  };
  const bump = (key: string, d: number) => setLines((ls) => {
    const q = (ls[key]?.quantity ?? 0) + d;
    const next = { ...ls };
    if (q <= 0) delete next[key];
    else next[key] = { ...ls[key], quantity: q };
    return next;
  });

  const submit = () => start(async () => {
    setError(undefined);
    const r = await createReservation({
      slug: venue.slug, eventId, tableId: tableId!, guests,
      items: Object.values(lines), showIds, signText: sign && showIds.includes(sign.id) ? signText || null : null,
      payMode, name: who.name, email: who.email, phone: who.phone, managerCode,
    });
    if ("error" in r) setError(r.error);
    else router.push(`/w/${venue.slug}/r/${r.token}`);
  });

  const next = () => (step < 4 ? setStep(step + 1) : submit());
  const nextLabel = step < 4 ? "Continuer" : pending ? "Envoi…" : `Réserver · ${eur(deposit)} ${payMode === "FULL" ? "" : "d'acompte"}`;

  return (
    <div className="w" style={themeVars(venue.theme) as React.CSSProperties}>
      <section className="w-main">
        <div className="w-top">
          {venue.theme.logoUrl ? <img className="w-logo" src={venue.theme.logoUrl} alt={venue.name} /> : <span className="w-brand">{venue.name}</span>}
          <nav className="w-steps" aria-label="Étapes">
            {STEPS.map((s, i) => <button key={s} className={i === step ? "on" : ""} disabled={i > step} onClick={() => setStep(i)} aria-label={s}>{i + 1}<span className="lbl">. {s}</span></button>)}
          </nav>
        </div>

        {step === 0 && (
          <>
            <h1 className="w-title">Réservez votre {venue.kind === "beach" ? "emplacement" : "carré"}</h1>
            {venue.rules && <div className="w-card w-rules">{venue.rules}</div>}
            {events.length === 0 ? <p className="w-sub">Aucune soirée ouverte à la réservation pour le moment.</p> : (
              <>
                <h2 style={{ fontSize: 16 }}>Soirée</h2>
                <div className="w-dates">
                  {events.map((e) => <button key={e.id} className={`w-opt ${e.id === eventId ? "on" : ""}`} onClick={() => { setEventId(e.id); setTableId(null); }}><b>{day(e.date)}</b><small>{e.name || "Soirée"}</small></button>)}
                </div>
                <h2 style={{ fontSize: 16 }}>Nombre de personnes</h2>
                <div className="w-qty"><button onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Moins">−</button><b>{guests} pers.</b><button onClick={() => setGuests(Math.min(40, guests + 1))} aria-label="Plus">+</button></div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="w-title">Choisissez votre {venue.kind === "beach" ? "emplacement" : "carré"}</h1>
            <p className="w-sub">{event && day(event.date)} · {guests} personnes. Touchez un emplacement libre.</p>
            <div className="w-plan" style={{ backgroundImage: venue.planImageUrl ? `url(${venue.planImageUrl})` : undefined }}>
              {tables.map((t) => {
                const taken = event?.taken.includes(t.id);
                const small = guests > t.capacity;
                return (
                  <button key={t.id} className={`w-t ${t.id === tableId ? "on" : ""}`} disabled={taken || small}
                    title={taken ? "Déjà réservé" : small ? `${t.capacity} pers. maximum` : undefined}
                    style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }} onClick={() => setTableId(t.id)}>
                    <span>{t.name}<small>{taken ? "Réservé" : `min ${eur(event?.prices[t.id] ?? t.minSpendCents)}`}</small></span>
                  </button>
                );
              })}
            </div>
            <div className="w-legend"><span>Libre</span><span>● Votre choix</span><span>▨ Indisponible ou trop petit</span></div>
            {table && cat && (
              <div className="w-info">
                <div>Catégorie<b>{cat.name}</b></div>
                <div>Minimum<b>{eur(minCents)}</b></div>
                <div>Shows offerts<b>{cat.includedShows}</b></div>
                <div>Acompte<b>{cat.depositPct} %</b></div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="w-title">Vos bouteilles</h1>
            <div className="w-card" style={{ display: "grid", gap: 8 }}>
              <div className="w-line"><span>Minimum du carré {table?.name}</span><b>{eur(bottlesCents)} / {eur(minCents)}</b></div>
              <div className="w-bar"><i style={{ width: `${Math.min(100, minCents ? (bottlesCents / minCents) * 100 : 100)}%` }} /></div>
            </div>
            <div className="w-bottles">
              {bottles.map((b) => (
                <div key={b.id} className="w-bottle">
                  <div className="ph">{b.photoUrl ? <img src={b.photoUrl} alt={b.name} /> : <span>{b.name.slice(0, 1)}</span>}</div>
                  <div><b>{b.name}</b><div className="w-sub" style={{ fontSize: 13 }}>{b.type}</div></div>
                  <select className="w-sel" value={pickSize[b.id] ?? b.sizes.find((s) => !s.soldOut)?.id} onChange={(e) => setPickSize({ ...pickSize, [b.id]: e.target.value })}>
                    {b.sizes.map((s) => <option key={s.id} value={s.id} disabled={s.soldOut}>{s.label} {s.volume} · {eur(s.priceCents)}{s.soldOut ? " · épuisé" : ""}</option>)}
                  </select>
                  {b.flavors.length > 0 && (
                    <select className="w-sel" value={pickFlavor[b.id] ?? b.flavors[0]} onChange={(e) => setPickFlavor({ ...pickFlavor, [b.id]: e.target.value })}>
                      {b.flavors.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  )}
                  <button className="w-btn" style={{ minHeight: 42 }} onClick={() => addLine(b.id)} disabled={b.sizes.every((s) => s.soldOut)}>Ajouter</button>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="w-title">Pancarte et shows</h1>
            <p className="w-sub">{cat?.includedShows ? `Votre catégorie ${cat.name} inclut ${cat.includedShows} show(s) offert(s) parmi ceux marqués « offert possible ». Il vous en reste ${freeLeft}.` : "Ajoutez des shows à votre soirée."}</p>
            {sign && showIds.includes(sign.id) && (
              <>
                <div className="w-sign">{signText || "VOTRE TEXTE ICI"}</div>
                <label className="w-field">Texte de la pancarte (40 caractères)<input className="w-input" maxLength={40} value={signText} onChange={(e) => setSignText(e.target.value.toUpperCase())} placeholder="HAPPY BDAY SARAH" /></label>
              </>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {shows.map((s) => {
                const on = showIds.includes(s.id);
                const p = priced.find((x) => x.id === s.id);
                const eligible = table && s.categoryIds.includes(table.categoryId);
                return (
                  <button key={s.id} className={`w-show ${on ? "on" : ""}`} onClick={() => setShowIds(on ? showIds.filter((x) => x !== s.id) : [...showIds, s.id])}>
                    <span className="m" style={s.mediaUrl ? { backgroundImage: `url(${s.mediaUrl})` } : undefined}>{s.mediaUrl ? "" : "✦"}</span>
                    <span>{s.name}<small>{s.description}</small></span>
                    <span>{on && p?.included ? <span className="w-badge">Offert</span> : eligible && freeLeft > 0 ? <span className="w-badge" style={{ opacity: .75 }}>Offert possible</span> : <b>{s.priceCents ? `+ ${eur(s.priceCents)}` : "Gratuit"}</b>}</span>
                  </button>
                );
              })}
              {shows.length === 0 && <p className="w-sub">Ce club ne propose pas encore de shows.</p>}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="w-title">Vos coordonnées</h1>
            <div className="w-card" style={{ display: "grid", gap: 12 }}>
              <label className="w-field">Nom et prénom<input className="w-input" autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} /></label>
              <label className="w-field">Email<input className="w-input" type="email" autoComplete="email" value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} /></label>
              <label className="w-field">Téléphone<input className="w-input" type="tel" autoComplete="tel" value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} /></label>
            </div>
            <h2 style={{ fontSize: 16 }}>Paiement</h2>
            <div className="w-pay">
              {venue.payModes.map((m) => <button key={m} className={`w-opt ${payMode === m ? "on" : ""}`} onClick={() => setPayMode(m as "FULL")}><b>{PAY[m][0]}</b><small>{PAY[m][1]}</small></button>)}
            </div>
            <div className="w-card w-line"><span>{payMode === "FULL" ? "À payer maintenant" : `Acompte obligatoire (${cat?.depositPct ?? 0} %, catégorie ${cat?.name})`}</span><b>{eur(deposit)}</b></div>
            {error && <p className="w-err" role="alert">{error}</p>}
          </>
        )}

        <div className="row" style={{ gap: 10 }}>
          {step > 0 && <button className="w-ghost" onClick={() => setStep(step - 1)}>Retour</button>}
          <button className="w-btn w-cta" disabled={!canNext || pending || events.length === 0} onClick={next}>{nextLabel}</button>
          {step === 2 && bottlesCents < minCents && <span className="w-sub">Encore {eur(minCents - bottlesCents)} pour atteindre le minimum du carré.</span>}
          {step === 1 && table && guests > table.capacity && <span className="w-sub">Ce carré accueille {table.capacity} personnes maximum.</span>}
        </div>
      </section>

      <aside className="w-aside" aria-label="Votre réservation">
        <h2 style={{ fontSize: 18 }}>Votre réservation</h2>
        {event && <div className="w-line"><span>{day(event.date)}</span><b>{guests} pers.</b></div>}
        {table && <div className="w-line"><span>{table.name}{cat ? ` · ${cat.name}` : ""}</span><b>min {eur(minCents)}</b></div>}
        {Object.entries(lines).map(([key, l]) => {
          const x = sizeIndex.get(l.sizeId);
          if (!x) return null;
          return (
            <div key={key} className="w-line" style={{ alignItems: "center" }}>
              <span>{x.b.name} {x.s.label}{l.flavor ? ` · ${l.flavor}` : ""}</span>
              <span className="w-qty" style={{ gap: 6 }}><button style={{ width: 28, height: 28, fontSize: 14 }} onClick={() => bump(key, -1)} aria-label="Retirer">−</button>{l.quantity}<button style={{ width: 28, height: 28, fontSize: 14 }} onClick={() => bump(key, 1)} aria-label="Ajouter">+</button><b style={{ minWidth: 60, textAlign: "right", fontSize: 14 }}>{eur(x.s.priceCents * l.quantity)}</b></span>
            </div>
          );
        })}
        {priced.map((p) => { const s = shows.find((x) => x.id === p.id)!; return <div key={p.id} className="w-line"><span>{s.name}{s.isSign && signText ? ` « ${signText} »` : ""}</span><b>{p.included ? "Offert" : eur(p.priceCents)}</b></div>; })}
        <div className="w-total"><span>Total</span><span>{eur(total)}</span></div>
        {table && total > 0 && payMode !== "FULL" && <div className="w-line"><span>Acompte ({cat?.depositPct} %)</span><b>{eur(deposit)}</b></div>}
        <p className="w-legal">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération. Réservation réservée aux 18 ans et plus. Propulsé par Tablo.</p>
      </aside>

      <div className="w-foot"><span><b>{eur(total)}</b>{total > 0 && payMode !== "FULL" && <span style={{ color: "var(--w-mute)", fontSize: 13 }}> · acompte {eur(deposit)}</span>}</span>
        <button className="w-btn" style={{ minHeight: 46 }} disabled={!canNext || pending || events.length === 0} onClick={next}>{step < 4 ? "Continuer" : pending ? "Envoi…" : "Réserver"}</button></div>
    </div>
  );
}
