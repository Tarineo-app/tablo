"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { addEvent, saveTheme, type ActionState } from "@/app/actions/club";
import { markSetup } from "@/app/actions/setup";
import { connectPayments, startSubscription } from "@/app/actions/stripe";
import StripeButton from "@/components/StripeButton";
import type { Box } from "@/app/w/[slug]/Plan3D";
import ColorPicker from "@/components/ColorPicker";
import BottleStudio, { type StudioBottle } from "@/components/BottleStudio";
import CarresStep from "./CarresStep";
import ShowsStep from "./ShowsStep";
import SignStep from "./SignStep";
import Phone from "./Phone";
import { FontPicker, RadiusPicker, btnRadiusOf, themeColors, uiRadiusOf } from "@/components/ThemeControls";
import { GARANTIE_JOURS } from "@/lib/legal";
import { AMBIANCES, DEFAULT_SIGN, type SignConfig, type Theme } from "@/lib/theme";

export type SetupData = {
  firstName: string;
  venue: { name: string; slug: string; kind: "club" | "beach"; planImageUrl: string | null; wallColor: string | null; tilt: number };
  theme: Theme;
  cats: { id: string; name: string; color: string | null; minEuros: number; depositPct: number; count: number; capacity: number }[];
  tables: Box[];
  bottles: StudioBottle[];
  shows: { id: string; name: string; price: number; description: string | null; mediaUrl: string | null; isSign: boolean; active: boolean }[];
  tablesFull: { id: string; name: string; categoryId: string; capacity: number; minCents: number | null; photoUrl: string | null }[];
  events: { id: string; name: string | null; date: string }[];
  done: string[];
  chargesEnabled: boolean;
  stripe: boolean;
  live: boolean;
};

/** Garantie affichée au moment de payer. À changer ici si la durée change (et dans les CGV). */

const STEPS = [
  { key: "ambiance", t: "Ambiance" },
  { key: "carres", t: "Carrés et prix" },
  { key: "bouteilles", t: "Bouteilles" },
  { key: "shows", t: "Shows" },
  { key: "pancarte", t: "Pancarte" },
  { key: "soiree", t: "Première soirée" },
  { key: "paiements", t: "Encaissement" },
  { key: "lancement", t: "Mise en ligne" },
] as const;
type Key = (typeof STEPS)[number]["key"];



export default function Setup({ data, initialStep }: { data: SetupData; initialStep?: string }) {
  const router = useRouter();
  const spot = data.venue.kind === "beach" ? "emplacement" : "carré";

  // Ce qui est fait, d'après la base (et les étapes sans trace : ambiance, paiements remis à plus tard).
  const doneOf: Record<Key, boolean> = {
    ambiance: data.done.includes("ambiance"),
    carres: data.tables.length > 0,
    bouteilles: data.bottles.length > 0,
    shows: data.shows.some((x) => !x.isSign && x.active),
    pancarte: data.done.includes("pancarte"),
    soiree: data.events.length > 0,
    paiements: data.chargesEnabled || data.done.includes("paiements-plus-tard"),
    lancement: data.live,
  };
  const firstTodo = STEPS.find((s) => !doneOf[s.key])?.key ?? "lancement";
  const [step, setStep] = useState<Key>((STEPS.find((s) => s.key === initialStep)?.key as Key) ?? firstTodo);
  const ready = STEPS.filter((s) => s.key !== "lancement").every((s) => doneOf[s.key]);
  const pct = Math.round((STEPS.filter((s) => s.key !== "lancement" && doneOf[s.key]).length / (STEPS.length - 1)) * 100);
  const idx = STEPS.findIndex((s) => s.key === step);
  const go = (k: Key) => { setStep(k); window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Ce que montre le téléphone : l'ambiance et la pancarte en cours de réglage, le carré survolé.
  const [liveTheme, setLiveTheme] = useState<Theme>(data.theme);
  const [signCfg, setSignCfg] = useState<SignConfig>(data.theme.sign ?? DEFAULT_SIGN);
  const [focusTable, setFocusTable] = useState<string | null>(null);
  const next = () => go(STEPS[Math.min(STEPS.length - 1, idx + 1)].key);

  return (
    <main className="su">
      <aside className="su-side">
        <Link href="/app" className="logo"><i />tablo</Link>
        <div>
          <b className="su-venue">{data.venue.name}</b>
          <div className="su-pct"><i style={{ width: `${pct}%` }} /></div>
          <span className="mute" style={{ fontSize: 13 }}>Configuration : {pct} %</span>
        </div>
        <ol className="su-steps">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button className={`${step === s.key ? "on" : ""} ${doneOf[s.key] ? "ok" : ""}`} onClick={() => go(s.key)}>
                <span className="n">{doneOf[s.key] ? "✓" : i + 1}</span>{s.t}
              </button>
            </li>
          ))}
        </ol>
        <Link href="/app" className="mute su-later">Finir plus tard</Link>
      </aside>

      <section className="su-main">
        <p className="su-eyebrow">Étape {idx + 1} sur {STEPS.length}</p>

        {step === "ambiance" && <Ambiance data={data} onChange={setLiveTheme} onDone={() => { router.refresh(); next(); }} />}

        {step === "carres" && <CarresStep data={data} spot={spot} onNext={next} onFocus={setFocusTable} />}

        {step === "bouteilles" && (
          <>
            <h1>Vos bouteilles</h1>
            <p className="mute">Ajoutez celles que vous avez en stock d&apos;un « + », réglez vos prix et, si vous voulez, combien vous pouvez en vendre par soirée (vide = illimité).</p>
            <BottleStudio bottles={data.bottles} compact />
            <div className="su-nav">
              <button className="btn btn-out" onClick={() => go("carres")}>Retour</button>
              <button className="btn btn-main" disabled={!data.bottles.length} onClick={next}>{data.bottles.length ? "Continuer" : "Ajoutez au moins une bouteille"}</button>
            </div>
          </>
        )}

        {step === "shows" && <ShowsStep data={data} spot={spot} onBack={() => go("bouteilles")} onNext={next} />}
        {step === "pancarte" && <SignStep data={data} cfg={signCfg} setCfg={setSignCfg} onBack={() => go("shows")} onNext={next} />}

        {step === "soiree" && (
          <>
            <h1>Votre première soirée</h1>
            <p className="mute">La date que vos clients pourront réserver en premier. Les suivantes s&apos;ajoutent en deux clics dans « Soirées ».</p>
            <EventForm onAdded={() => router.refresh()} />
            {data.events.length > 0 && (
              <ul className="su-list">{data.events.map((e) => <li key={e.id}><b style={{ textTransform: "capitalize" }}>{new Date(e.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })}</b><span className="mute">{e.name ?? ""}</span></li>)}</ul>
            )}
            <div className="su-nav">
              <button className="btn btn-out" onClick={() => go("shows")}>Retour</button>
              <button className="btn btn-main" disabled={!data.events.length} onClick={next}>{data.events.length ? "Continuer" : "Ajoutez une date"}</button>
            </div>
          </>
        )}

        {step === "paiements" && (
          <>
            <h1>Recevoir les acomptes de vos clients</h1>
            <p className="mute">Les clients paient leur acompte en ligne et l&apos;argent arrive directement sur le compte du club, via Stripe. Tablo ne prend aucune commission.</p>
            {data.chargesEnabled ? (
              <p className="okmsg">C&apos;est activé : les acomptes arrivent sur votre compte.</p>
            ) : (
              <div className="card" style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0 }}>Comptez 5 minutes : Stripe vous demande l&apos;identité du gérant, le SIRET et l&apos;IBAN du club. <strong>Vous pouvez passer cette étape</strong> et voir la suite : tant que ce n&apos;est pas activé, l&apos;acompte se règle sur place.</p>
                {data.stripe ? <StripeButton action={connectPayments} label="Activer les paiements" /> : <p className="mute" style={{ margin: 0 }}>Le paiement en ligne sera branché très bientôt.</p>}
              </div>
            )}
            <div className="su-nav">
              <button className="btn btn-out" onClick={() => go("soiree")}>Retour</button>
              {data.chargesEnabled
                ? <button className="btn btn-main" onClick={next}>Continuer</button>
                : <LaterButton onDone={() => { router.refresh(); next(); }} />}
            </div>
          </>
        )}

        {step === "lancement" && <Launch data={data} ready={ready} doneOf={doneOf} go={go} />}
      </section>
      <aside className="su-phone"><Phone step={step} data={data} theme={step === "ambiance" ? liveTheme : { ...data.theme, sign: signCfg }} sign={signCfg} focusTable={focusTable} /></aside>
    </main>
  );
}

/* ---------- Étape 1 : ambiance ---------- */
function Ambiance({ data, onDone, onChange }: { data: SetupData; onDone: () => void; onChange: (t: Theme) => void }) {
  const [t, setT0] = useState<Theme>(data.theme);
  const setT = (n: Theme) => { setT0(n); onChange(n); };
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveTheme(t);
    if (r?.error) return setErr(r.error);
    await markSetup("ambiance");
    onDone();
  });
  return (
    <>
      <h1>L&apos;ambiance de votre réservation</h1>
      <p className="mute">Choisissez un point de départ et votre couleur. Tout reste modifiable ensuite, partie par partie, dans « Ambiance et marque ».</p>
      <div className="su-two">
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="ambs">
            {Object.values(AMBIANCES).map((a) => (
              <button type="button" key={a.amb} className={`amb ${t.amb === a.amb ? "on" : ""}`}
                onClick={() => setT({ ...t, amb: a.amb, accent: a.accent, grad: a.grad, mode: a.mode, font: a.font, head: a.head, btn: a.btn, colors: {}, btnRadius: undefined, uiRadius: undefined })}>
                <span className="sw" style={{ background: a.swatch }}><em style={{ fontFamily: `'${a.head}'`, color: a.amb === "pool" ? "#fff" : a.accent }}>Aa</em></span>
                {a.name}<small>{a.desc}</small>
              </button>
            ))}
          </div>
          <div className="field">Votre couleur
            <div className="row"><ColorPicker value={t.accent} onChange={(c) => setT({ ...t, accent: c, amb: "perso" })} themeColors={themeColors(t)} label="Votre couleur" />
              <span className="mute" style={{ fontSize: 13 }}>Titres, sélection, prix</span></div>
          </div>
          <div className="field">Police des titres<FontPicker value={t.head} onChange={(f) => setT({ ...t, head: f, amb: "perso" })} /></div>
          <RadiusPicker label="Arrondi des boutons" sample="btn" max={30} value={btnRadiusOf(t)} onChange={(v) => setT({ ...t, btnRadius: v, amb: "perso" })} />
          <RadiusPicker label="Arrondi de l'interface" sample="card" max={28} value={uiRadiusOf(t)} onChange={(v) => setT({ ...t, uiRadius: v, amb: "perso" })} />
          <p className="mute" style={{ fontSize: 13, margin: 0 }}>Images détourées, textes, couleurs partie par partie : tout se règle ensuite dans « Ambiance et marque ».</p>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="su-nav"><span /><button className="btn btn-main" disabled={pending} onClick={save}>{pending ? "Enregistrement…" : "Valider l'ambiance"}</button></div>
    </>
  );
}

/* ---------- Étape 5 : première soirée ---------- */
function EventForm({ onAdded }: { onAdded: () => void }) {
  const [state, action, pending] = useActionState(async (s: ActionState, f: FormData) => addEvent(s, f), undefined);
  useEffect(() => { if (state?.ok) { onAdded(); (document.getElementById("su-event") as HTMLFormElement | null)?.reset(); } }, [state, onAdded]);
  return (
    <form id="su-event" action={action} className="card su-addrow ev">
      <label className="field">Date<input className="input" type="date" name="date" required /></label>
      <label className="field">Nom de la soirée (facultatif)<input className="input" name="name" placeholder="Ex. Velvet Gold" /></label>
      <button className="btn btn-main" disabled={pending}>{pending ? "…" : "Ajouter"}</button>
      {state?.error && <span className="err" style={{ gridColumn: "1 / -1" }}>{state.error}</span>}
    </form>
  );
}

function LaterButton({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  return <button className="btn btn-main" disabled={pending} onClick={() => start(async () => { await markSetup("paiements-plus-tard"); onDone(); })}>{pending ? "…" : "Passer : je l'activerai plus tard"}</button>;
}

/* ---------- Étape 7 : mise en ligne et paiement ---------- */
function Launch({ data, ready, doneOf, go }: { data: SetupData; ready: boolean; doneOf: Record<Key, boolean>; go: (k: Key) => void }) {
  if (data.live) {
    return (
      <>
        <h1><span className="holo">{data.venue.name}</span> est en ligne.</h1>
        <p className="mute">Vos clients peuvent réserver. Il reste à poser le bouton sur votre site et le lien dans votre bio Instagram.</p>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-main" href="/app/integrer">Poser le bouton sur mon site</Link>
          <a className="btn btn-out" href={`/w/${data.venue.slug}`} target="_blank" rel="noreferrer">Voir ma page de réservation ↗</a>
        </div>
      </>
    );
  }
  return (
    <>
      <h1>{ready ? <>Tout est prêt, <span className="holo">{data.firstName || data.venue.name}</span>.</> : "Presque prêt"}</h1>
      <p className="mute">{ready ? `Votre espace est configuré à 100 %. Il ne reste qu'à ouvrir les réservations de ${data.venue.name}.` : "Terminez les étapes cochées en gris, puis ouvrez vos réservations."}</p>
      <ul className="su-check">
        {STEPS.filter((s) => s.key !== "lancement").map((s) => (
          <li key={s.key} className={doneOf[s.key] ? "ok" : ""}>
            <span>{doneOf[s.key] ? "✓" : "•"}</span>{s.t}
            {!doneOf[s.key] && <button className="btn btn-out" onClick={() => go(s.key)}>Terminer</button>}
          </li>
        ))}
      </ul>
      <section className="su-offer">
        <div className="su-price"><b>200 €</b><span>par mois, pour {data.venue.name}</span></div>
        <ul>
          <li>Réservations, bouteilles, shows et acomptes en ligne</li>
          <li>Zéro commission : l&apos;argent des clients arrive chez vous</li>
          <li>Sans engagement, résiliable en un clic</li>
        </ul>
        <div className="su-guarantee">
          <b>Satisfait ou remboursé {GARANTIE_JOURS} jours</b>
          <span>Si Tablo ne vous convient pas dans les {GARANTIE_JOURS} jours qui suivent votre premier paiement, on vous rembourse ce premier mois, sans question.</span>
        </div>
        <StripeButton action={startSubscription} label={`Mettre mes ${data.venue.kind === "beach" ? "emplacements" : "carrés"} en ligne · 200 €`} disabled={!ready} />
        <small className="mute">Paiement sécurisé par Stripe. Facture au nom du club. En payant, vous acceptez les <Link href="/cgv" target="_blank" style={{ color: "inherit" }}>conditions générales de vente</Link>.</small>
      </section>
    </>
  );
}
