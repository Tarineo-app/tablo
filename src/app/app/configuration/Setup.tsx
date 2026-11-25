"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { addBottle, addEvent, saveTheme, type ActionState } from "@/app/actions/club";
import { addSetupShows, autoPlan, markSetup } from "@/app/actions/setup";
import { connectPayments, startSubscription } from "@/app/actions/stripe";
import StripeButton from "@/components/StripeButton";
import Plan3D, { type Box } from "@/app/w/[slug]/Plan3D";
import { samplePlan } from "@/lib/sample-plan";
import { AMBIANCES, themeVars, type Theme } from "@/lib/theme";

export type SetupData = {
  firstName: string;
  venue: { name: string; slug: string; kind: "club" | "beach"; planImageUrl: string | null; wallColor: string | null; tilt: number };
  theme: Theme;
  cats: { id: string; name: string; color: string | null; minEuros: number; depositPct: number; count: number; capacity: number }[];
  tables: Box[];
  bottles: { id: string; name: string; type: string | null; price: string }[];
  shows: { id: string; name: string; price: number }[];
  events: { id: string; name: string | null; date: string }[];
  done: string[];
  chargesEnabled: boolean;
  stripe: boolean;
  live: boolean;
};

/** Garantie affichée au moment de payer. À changer ici si la durée change (et dans les CGV). */
const GARANTIE_JOURS = 30;

const STEPS = [
  { key: "ambiance", t: "Ambiance" },
  { key: "carres", t: "Carrés et prix" },
  { key: "bouteilles", t: "Bouteilles" },
  { key: "shows", t: "Shows" },
  { key: "soiree", t: "Première soirée" },
  { key: "paiements", t: "Encaissement" },
  { key: "lancement", t: "Mise en ligne" },
] as const;
type Key = (typeof STEPS)[number]["key"];

const SHOW_IDEAS = {
  club: [
    { name: "Pancarte personnalisée", description: "Le message du client porté jusqu'à la table", priceEuros: 30, isSign: true },
    { name: "Arrivée des bouteilles en musique", description: "Le service arrive avec la musique et les lumières", priceEuros: 50 },
    { name: "Annonce du DJ", description: "Le prénom du client annoncé au micro", priceEuros: 20 },
    { name: "Canon à confettis", description: "Explosion de confettis au-dessus du carré", priceEuros: 90 },
    { name: "Mallette lumineuse", description: "Bouteille servie dans une mallette LED", priceEuros: 120 },
    { name: "Danseurs à la table", description: "Show de quelques minutes autour du carré", priceEuros: 150 },
  ],
  beach: [
    { name: "Pancarte personnalisée", description: "Le message du client porté jusqu'à son emplacement", priceEuros: 30, isSign: true },
    { name: "Arrivée des bouteilles en musique", description: "Le service arrive avec la musique", priceEuros: 50 },
    { name: "Annonce du DJ", description: "Le prénom du client annoncé au micro", priceEuros: 20 },
    { name: "Fumigènes colorés", description: "Fumée de couleur pour la photo de groupe", priceEuros: 60 },
    { name: "Plateau de fruits", description: "Fruits frais servis avec les bouteilles", priceEuros: 45 },
  ],
};

const TYPES = ["Champagne", "Vodka", "Whisky", "Gin", "Rhum", "Tequila"];

export default function Setup({ data, initialStep }: { data: SetupData; initialStep?: string }) {
  const router = useRouter();
  const spot = data.venue.kind === "beach" ? "emplacement" : "carré";

  // Ce qui est fait, d'après la base (et les étapes sans trace : ambiance, paiements remis à plus tard).
  const doneOf: Record<Key, boolean> = {
    ambiance: data.done.includes("ambiance"),
    carres: data.tables.length > 0,
    bouteilles: data.bottles.length > 0,
    shows: data.shows.length > 0,
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

        {step === "ambiance" && <Ambiance data={data} onDone={() => { router.refresh(); next(); }} />}

        {step === "carres" && <Carres data={data} spot={spot} onNext={next} />}

        {step === "bouteilles" && (
          <>
            <h1>Vos bouteilles</h1>
            <p className="mute">Ajoutez celles que vous vendez en carré. Une ligne suffit par bouteille : vous ajouterez photos, formats et parfums plus tard dans « Bouteilles ».</p>
            <BottleForm onAdded={() => router.refresh()} />
            {data.bottles.length > 0 && (
              <ul className="su-list">{data.bottles.map((b) => <li key={b.id}><b>{b.name}</b><span className="mute">{[b.type, b.price].filter(Boolean).join(" · ")}</span></li>)}</ul>
            )}
            <div className="su-nav">
              <button className="btn btn-out" onClick={() => go("carres")}>Retour</button>
              <button className="btn btn-main" disabled={!data.bottles.length} onClick={next}>{data.bottles.length ? "Continuer" : "Ajoutez au moins une bouteille"}</button>
            </div>
          </>
        )}

        {step === "shows" && <Shows data={data} spot={spot} onBack={() => go("bouteilles")} onNext={next} />}

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
                <p style={{ margin: 0 }}>Comptez 5 minutes : Stripe vous demande l&apos;identité du gérant, le SIRET et l&apos;IBAN du club.</p>
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
    </main>
  );
}

/* ---------- Étape 1 : ambiance ---------- */
function Ambiance({ data, onDone }: { data: SetupData; onDone: () => void }) {
  const [t, setT] = useState<Theme>(data.theme);
  const [pick, setPick] = useState<string | null>("c");
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
                onClick={() => setT({ ...t, amb: a.amb, accent: a.accent, grad: a.grad, mode: a.mode, font: a.font, head: a.head, btn: a.btn, colors: {} })}>
                <span className="sw" style={{ background: a.swatch }}><em style={{ fontFamily: `'${a.head}'`, color: a.amb === "pool" ? "#fff" : a.accent }}>Aa</em></span>
                {a.name}<small>{a.desc}</small>
              </button>
            ))}
          </div>
          <label className="field">Votre couleur
            <div className="row"><input type="color" value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value, amb: "perso" })} style={{ width: 54, height: 44, border: 0, background: "none" }} />
              <span className="mute" style={{ fontSize: 13 }}>Titres, sélection, prix</span></div>
          </label>
        </div>
        <div className="su-preview" style={themeVars(t) as React.CSSProperties}>
          <b style={{ fontFamily: "var(--w-head)", fontSize: 20, color: "var(--w-title)" }}>Choisissez votre {data.venue.kind === "beach" ? "emplacement" : "carré"}</b>
          <Plan3D planImageUrl={null} wallColor={null} tilt={50} beach={data.venue.kind === "beach"} selected={pick} onSelect={setPick} boxes={samplePlan(data.venue.kind)} />
          <div className="su-btn">Continuer</div>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="su-nav"><span /><button className="btn btn-main" disabled={pending} onClick={save}>{pending ? "Enregistrement…" : "Valider l'ambiance"}</button></div>
    </>
  );
}

/* ---------- Étape 2 : carrés et prix, plan dessiné automatiquement ---------- */
function Carres({ data, spot, onNext }: { data: SetupData; spot: string; onNext: () => void }) {
  const router = useRouter();
  const has = data.tables.length > 0;
  const [rows, setRows] = useState(data.cats.map((c) => ({ ...c, count: c.count || (has ? 0 : [2, 2, 4, 2][data.cats.indexOf(c)] ?? 2) })));
  const [msg, setMsg] = useState<ActionState>();
  const [pick, setPick] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const patch = (i: number, p: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const save = () => start(async () => {
    const r = await autoPlan({ cats: rows.map((c) => ({ id: c.id, count: Math.round(c.count), minEuros: c.minEuros, depositPct: Math.round(c.depositPct), capacity: Math.max(1, Math.round(c.capacity)) })) });
    setMsg(r);
    if (r?.ok) router.refresh();
  });
  return (
    <>
      <h1>Vos {spot}s et leurs prix</h1>
      <p className="mute">Le minimum, c&apos;est ce que le client s&apos;engage à consommer en bouteilles. L&apos;acompte est payé en ligne à la réservation : c&apos;est ce qui évite les {spot}s réservés et vides.</p>
      <div className="su-table" role="table">
        <div className="su-tr head" role="row"><span>Catégorie</span><span>{has ? "Sur le plan" : `Nombre de ${spot}s`}</span><span>Personnes</span><span>Minimum</span><span>Acompte</span></div>
        {rows.map((c, i) => (
          <div className="su-tr" role="row" key={c.id}>
            <span className="cat"><i style={{ background: c.color ?? "#a970ff" }} />{c.name}</span>
            {has ? <span className="mute">{data.cats[i].count}</span> : <input className="input" inputMode="numeric" value={c.count} onChange={(e) => patch(i, { count: num(e.target.value) })} aria-label={`Nombre de ${spot}s ${c.name}`} />}
            <input className="input" inputMode="numeric" value={c.capacity} onChange={(e) => patch(i, { capacity: num(e.target.value) })} aria-label={`Personnes ${c.name}`} disabled={has} />
            <span className="unit"><input className="input" inputMode="decimal" value={c.minEuros} onChange={(e) => patch(i, { minEuros: num(e.target.value) })} aria-label={`Minimum ${c.name}`} />€</span>
            <span className="unit"><input className="input" inputMode="numeric" value={c.depositPct} onChange={(e) => patch(i, { depositPct: Math.min(100, num(e.target.value)) })} aria-label={`Acompte ${c.name}`} />%</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 12 }}>
        <button className="btn btn-main" disabled={pending} onClick={save}>{pending ? "Un instant…" : has ? "Enregistrer les prix" : "Placer mes " + spot + "s sur le plan"}</button>
        {msg?.error && <span className="err">{msg.error}</span>}
        {msg?.ok && <span className="okmsg">{msg.ok}</span>}
      </div>
      {has && (
        <div className="su-plan" style={themeVars(data.theme) as React.CSSProperties}>
          <Plan3D planImageUrl={data.venue.planImageUrl} wallColor={data.venue.wallColor} tilt={data.venue.tilt} beach={data.venue.kind === "beach"} selected={pick} onSelect={setPick} boxes={data.tables} />
          <p className="mute" style={{ fontSize: 13, margin: "8px 0 0" }}>Votre plan, tel que vos clients le verront. Importez la photo de votre salle et déplacez les {spot}s dans <Link href="/app/plan" style={{ color: "inherit" }}>Plan des carrés</Link>, quand vous voulez.</p>
        </div>
      )}
      <div className="su-nav"><span /><button className="btn btn-main" disabled={!has} onClick={onNext}>{has ? "Continuer" : `Placez d'abord vos ${spot}s`}</button></div>
    </>
  );
}

/* ---------- Étape 3 : une bouteille par ligne ---------- */
function BottleForm({ onAdded }: { onAdded: () => void }) {
  const [state, action, pending] = useActionState(async (s: ActionState, f: FormData) => addBottle(s, f), undefined);
  const [type, setType] = useState("Champagne");
  useEffect(() => { if (state?.ok) { onAdded(); (document.getElementById("su-bottle") as HTMLFormElement | null)?.reset(); } }, [state, onAdded]);
  return (
    <form id="su-bottle" action={action} className="card su-addrow">
      <label className="field">Bouteille<input className="input" name="name" required placeholder="Ex. Champagne brut" /></label>
      <label className="field">Type
        <select className="select" name="type" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </label>
      <label className="field">Format<input className="input" name="volume0" defaultValue={type === "Champagne" ? "75 cl" : "70 cl"} key={type} /></label>
      <input type="hidden" name="label0" value="Bouteille" />
      <label className="field">Prix (€)<input className="input" name="price0" inputMode="decimal" required placeholder="180" /></label>
      <button className="btn btn-main" disabled={pending}>{pending ? "…" : "Ajouter"}</button>
      {state?.error && <span className="err" style={{ gridColumn: "1 / -1" }}>{state.error}</span>}
    </form>
  );
}

/* ---------- Étape 4 : shows suggérés ---------- */
function Shows({ data, spot, onBack, onNext }: { data: SetupData; spot: string; onBack: () => void; onNext: () => void }) {
  const router = useRouter();
  const have = new Set(data.shows.map((s) => s.name.toLowerCase()));
  const ideas = SHOW_IDEAS[data.venue.kind].filter((s) => !have.has(s.name.toLowerCase()));
  const [sel, setSel] = useState(() => ideas.map((s, i) => ({ ...s, on: i < 3 })));
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const list = sel.filter((s) => s.on).map(({ name, description, priceEuros, isSign }) => ({ name, description, priceEuros, isSign }));
    if (!list.length) return setMsg({ error: "Cochez au moins un show." });
    const r = await addSetupShows(list);
    setMsg(r);
    if (r?.ok) router.refresh();
  });
  return (
    <>
      <h1>Vos shows et pancartes</h1>
      <p className="mute">C&apos;est ce qui fait grimper le panier : ils sont proposés au client pendant qu&apos;il réserve son {spot}. Cochez ceux que vous faites, ajustez le prix (0 € = gratuit).</p>
      {sel.length > 0 && (
        <div className="su-shows">
          {sel.map((s, i) => (
            <label key={s.name} className={`su-show ${s.on ? "on" : ""}`}>
              <input type="checkbox" checked={s.on} onChange={(e) => setSel((x) => x.map((y, j) => (j === i ? { ...y, on: e.target.checked } : y)))} />
              <span><b>{s.name}</b><small>{s.description}</small></span>
              <span className="unit"><input className="input" inputMode="decimal" value={s.priceEuros} onChange={(e) => setSel((x) => x.map((y, j) => (j === i ? { ...y, priceEuros: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) } : y)))} aria-label={`Prix ${s.name}`} />€</span>
            </label>
          ))}
        </div>
      )}
      {sel.length > 0 && (
        <div className="row" style={{ gap: 12 }}>
          <button className="btn btn-main" disabled={pending} onClick={add}>{pending ? "…" : "Ajouter à ma carte"}</button>
          {msg?.error && <span className="err">{msg.error}</span>}
          {msg?.ok && <span className="okmsg">{msg.ok}</span>}
        </div>
      )}
      {data.shows.length > 0 && <ul className="su-list">{data.shows.map((s) => <li key={s.id}><b>{s.name}</b><span className="mute">{s.price ? `${s.price.toLocaleString("fr-FR")} €` : "Gratuit"}</span></li>)}</ul>}
      <p className="mute" style={{ fontSize: 13 }}>Photos, vidéos et shows liés aux bouteilles (« couronne de 3 champagnes ») : dans <Link href="/app/shows" style={{ color: "inherit" }}>Shows et pancarte</Link>.</p>
      <div className="su-nav">
        <button className="btn btn-out" onClick={onBack}>Retour</button>
        <button className="btn btn-main" disabled={!data.shows.length} onClick={onNext}>{data.shows.length ? "Continuer" : "Ajoutez au moins un show"}</button>
      </div>
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
  return <button className="btn btn-out" disabled={pending} onClick={() => start(async () => { await markSetup("paiements-plus-tard"); onDone(); })}>Plus tard</button>;
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
        <small className="mute">Paiement sécurisé par Stripe. Facture au nom du club.</small>
      </section>
    </>
  );
}
