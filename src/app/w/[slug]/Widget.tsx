"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReservation } from "@/app/actions/reserve";
import { findGarage, type GarageFound } from "@/app/actions/garage";
import { bottleCount, bottleOptionUnlocked, depositCents, priceShows } from "@/lib/pricing";
import { themeVars } from "@/lib/theme";
import type { WidgetData } from "@/lib/widget";
import ModeTabs from "./ModeTabs";

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
  const [garageCode, setGarageCode] = useState("");
  const [garage, setGarage] = useState<GarageFound | null>(null);
  const [garageMsg, setGarageMsg] = useState<string>();
  const [garageOpen, setGarageOpen] = useState(false);
  const [pending, start] = useTransition();

  const event = events.find((e) => e.id === eventId);
  const table = tables.find((t) => t.id === tableId);
  const cat = categories.find((c) => c.id === table?.categoryId);
  const baseMinCents = table ? (event?.prices[table.id] ?? table.minSpendCents) : 0;
  const sizeIndex = useMemo(() => new Map(bottles.flatMap((b) => b.sizes.map((s) => [s.id, { b, s }] as const))), [bottles]);
  const bottleLines = Object.values(lines).map((l) => ({ ...l, ...sizeIndex.get(l.sizeId)! })).filter((l) => l.s);
  const bottlesCents = bottleLines.reduce((a, l) => a + l.s.priceCents * l.quantity, 0);
  // Le garage remplace le minimum du carré par « au moins N bouteilles », sauf si le club garde les deux.
  const minCents = garage && !garage.keepsMin ? 0 : baseMinCents;
  const nBottles = bottleCount(bottleLines);
  const garageOk = !garage || nBottles >= garage.minBottles;
  const lineBottles = bottleLines.map((l) => ({ bottleId: l.s.bottleId, quantity: l.quantity }));
  const options = shows.filter((s) => s.minBottles > 0);
  const sign = shows.find((s) => s.isSign);
  const chosen = shows.filter((s) => showIds.includes(s.id) && bottleOptionUnlocked(s, lineBottles));
  const priced = table ? priceShows(chosen, table.categoryId, cat?.includedShows ?? 0) : [];
  const showsCents = priced.reduce((a, s) => a + s.priceCents, 0);
  const total = bottlesCents + showsCents;
  const deposit = payMode === "FULL" ? total : depositCents(total, cat?.depositPct ?? 0);
  const freeLeft = Math.max(0, (cat?.includedShows ?? 0) - priced.filter((p) => p.included).length);

  const canNext = [
    !!event && guests > 0,
    !!table && guests <= (table?.capacity ?? 0),
    bottlesCents >= minCents && bottleLines.length > 0 && garageOk,
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
  const unlocked = (s: { minBottles: number; bottleId: string | null }) => bottleOptionUnlocked(s, lineBottles);
  const toggleShow = (id: string) => setShowIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const lookGarage = () => start(async () => {
    setGarageMsg(undefined);
    const r = await findGarage(venue.slug, garageCode);
    if ("error" in r) { setGarage(null); setGarageMsg(r.error); }
    else { setGarage(r.item); setGarageMsg(undefined); }
  });

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
      items: Object.values(lines), showIds: chosen.map((s) => s.id), signText: sign && showIds.includes(sign.id) ? signText || null : null,
      payMode, name: who.name, email: who.email, phone: who.phone, managerCode,
      garageCode: garage?.code ?? null,
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
        {events.some((e) => e.tiers.length > 0) && step === 0 && <ModeTabs slug={venue.slug} kind={venue.kind} current="table" managerCode={managerCode} />}

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
              {garage && !garage.keepsMin ? (
                <>
                  <div className="w-line"><span>À racheter pour reprendre votre bouteille</span><b>{nBottles} / {garage.minBottles} bouteille{garage.minBottles > 1 ? "s" : ""}</b></div>
                  <div className="w-bar"><i style={{ width: `${Math.min(100, (nBottles / Math.max(1, garage.minBottles)) * 100)}%` }} /></div>
                </>
              ) : (
                <>
                  <div className="w-line"><span>Minimum du carré {table?.name}</span><b>{eur(bottlesCents)} / {eur(minCents)}</b></div>
                  <div className="w-bar"><i style={{ width: `${Math.min(100, minCents ? (bottlesCents / minCents) * 100 : 100)}%` }} /></div>
                  {garage && <div className="w-line"><span>Et au moins {garage.minBottles} bouteille{garage.minBottles > 1 ? "s" : ""} pour votre garage</span><b>{nBottles} / {garage.minBottles}</b></div>}
                </>
              )}
            </div>

            {venue.garage.enabled && (
              <div className="w-garage">
                {garage ? (
                  <div className="w-gfound">
                    <span className="w-gicon" aria-hidden="true">🔖</span>
                    <div>
                      <b>Votre bouteille vous attend</b>
                      <small>{garage.quantity > 1 ? `${garage.quantity} × ` : ""}{garage.label}{garage.flavor ? ` · ${garage.flavor}` : ""} · au nom de {garage.owner}</small>
                      {garage.note && <small>{garage.note}</small>}
                      <small>À reprendre avant le {new Date(garage.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}</small>
                    </div>
                    <button className="w-btn w-ghost" onClick={() => { setGarage(null); setGarageCode(""); }}>Retirer</button>
                  </div>
                ) : garageOpen ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <b style={{ fontSize: 15 }}>Votre code garage</b>
                    <p className="w-sub" style={{ margin: 0, textTransform: "none" }}>Le club vous l&apos;a donné la dernière fois. Reprendre une bouteille demande d&apos;en racheter au moins {venue.garage.minBottles}.</p>
                    <div className="row" style={{ gap: 8 }}>
                      <input className="w-input" style={{ flex: 1, minWidth: 140, textTransform: "uppercase", letterSpacing: ".12em" }} value={garageCode} maxLength={12}
                        onChange={(e) => setGarageCode(e.target.value.toUpperCase())} placeholder="GK4T9P" aria-label="Code de votre bouteille au garage" />
                      <button className="w-btn" style={{ minHeight: 44 }} disabled={pending || garageCode.trim().length < 4} onClick={lookGarage}>Retrouver</button>
                    </div>
                    {garageMsg && <p className="w-err" role="alert">{garageMsg}</p>}
                  </div>
                ) : (
                  <button className="w-glink" onClick={() => setGarageOpen(true)}>
                    <span className="w-gicon" aria-hidden="true">🔖</span>
                    <span><b>J&apos;ai une bouteille au garage</b><small>Vous aviez laissé une bouteille entamée ? Reprenez-la ce soir.</small></span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            )}
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

            {options.length > 0 && (
              <>
                <h2 style={{ fontSize: 16, marginTop: 4 }}>Avec vos bouteilles</h2>
                <p className="w-sub" style={{ textTransform: "none" }}>Les arrivées en grande pompe : elles se débloquent quand vous avez assez de bouteilles.</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {options.map((s) => {
                    const ok = unlocked(s);
                    const on = showIds.includes(s.id) && ok;
                    const p = priced.find((x) => x.id === s.id);
                    const need = s.bottleId ? bottles.find((b) => b.id === s.bottleId)?.name ?? "bouteilles" : "bouteilles";
                    const have = lineBottles.filter((l) => !s.bottleId || l.bottleId === s.bottleId).reduce((a, l) => a + l.quantity, 0);
                    return (
                      <button key={s.id} className={`w-show ${on ? "on" : ""}`} disabled={!ok} onClick={() => toggleShow(s.id)}>
                        <span className="m" style={s.mediaUrl ? { backgroundImage: `url(${s.mediaUrl})` } : undefined}>{s.mediaUrl ? "" : "♛"}</span>
                        <span>{s.name}<small>{ok ? s.description : `Encore ${s.minBottles - have} ${need} (${have} / ${s.minBottles})`}</small></span>
                        <span>{on && p?.included ? <span className="w-badge">Offert</span> : <b>{s.priceCents ? `+ ${eur(s.priceCents)}` : "Gratuit"}</b>}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
              {shows.filter((s) => s.minBottles === 0).map((s) => {
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
              {shows.filter((s) => s.minBottles === 0).length === 0 && <p className="w-sub">Ce club ne propose pas encore de shows.</p>}
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
          {step === 2 && bottlesCents >= minCents && !garageOk && <span className="w-sub">Encore {garage!.minBottles - nBottles} bouteille{garage!.minBottles - nBottles > 1 ? "s" : ""} pour reprendre celle du garage.</span>}
          {step === 1 && table && guests > table.capacity && <span className="w-sub">Ce carré accueille {table.capacity} personnes maximum.</span>}
        </div>
      </section>

      <aside className="w-aside" aria-label="Votre réservation">
        <h2 style={{ fontSize: 18 }}>Votre réservation</h2>
        {event && <div className="w-line"><span>{day(event.date)}</span><b>{guests} pers.</b></div>}
        {table && <div className="w-line"><span>{table.name}{cat ? ` · ${cat.name}` : ""}</span><b>{garage && !garage.keepsMin ? `${garage.minBottles} bout. min` : `min ${eur(minCents)}`}</b></div>}
        {garage && <div className="w-line"><span>Du garage · {garage.quantity > 1 ? `${garage.quantity} × ` : ""}{garage.label}</span><b>Offerte</b></div>}
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
