"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signup, googleWithLook, type FormState } from "@/app/actions/auth";

/**
 * Accueil d'un club, avant tout identifiant : cinq questions pour comprendre comment il vend
 * ses carrés aujourd'hui, puis « votre plan » construit à partir de ses réponses, et seulement
 * à la fin la création du compte. Les réponses voyagent dans le formulaire (champs look_*),
 * puis dans un cookie, jusqu'à la création de son espace.
 */

type Look = Record<string, string | undefined>;
type Answers = { kind: string; club: string; city: string; size: string; sell: string[]; goals: string[] };

const KINDS = [
  { v: "club", t: "Club, discothèque", s: "Carrés, bouteilles, shows" },
  { v: "beach", t: "Beach club, rooftop", s: "Cabanas, lits balinais, transats" },
  { v: "bar", t: "Bar d'ambiance, lounge", s: "Tables VIP, bouteilles" },
];
const SIZES = [
  { v: "lt10", t: "Moins de 10" },
  { v: "10-25", t: "Entre 10 et 25" },
  { v: "gt25", t: "Plus de 25" },
];
const SELL = [
  { v: "dm", t: "Par DM Instagram" },
  { v: "whatsapp", t: "Sur WhatsApp" },
  { v: "phone", t: "Par téléphone" },
  { v: "place", t: "Sur place, le soir même" },
  { v: "platform", t: "Sur une plateforme de billetterie" },
];
const GOALS = [
  { v: "upsell", t: "Vendre plus de bouteilles et de shows" },
  { v: "noshow", t: "Fini les carrés réservés… et vides" },
  { v: "managers", t: "Moins de messages pour mes managers" },
  { v: "live", t: "Suivre mes ventes de la soirée en direct" },
  { v: "brand", t: "Une réservation à l'image de mon club" },
];

/** Ce que Tablo change pour lui, d'après ses réponses. Rien d'inventé : chaque ligne est une fonction réelle. */
function plan(a: Answers): string[] {
  const out: string[] = [];
  const beach = a.kind === "beach";
  const spot = beach ? "emplacement" : "carré";
  if (a.goals.includes("upsell")) out.push(`Bouteilles, shows et pancartes proposés pendant la réservation, au moment où le client a envie de se faire plaisir.`);
  if (a.goals.includes("noshow")) out.push(`Acompte payé en ligne dès la réservation, réglable par catégorie : un ${spot} réservé est un ${spot} payé.`);
  if (a.sell.includes("dm") || a.sell.includes("whatsapp")) out.push(`Un lien à mettre dans votre bio Instagram et à envoyer sur WhatsApp : le client choisit son ${spot} seul, sans aller-retour de messages.`);
  if (a.goals.includes("managers")) out.push(`Chaque manager a son lien et compose ses offres sur mesure ; vous voyez qui vend quoi.`);
  if (a.sell.includes("phone") || a.sell.includes("place")) out.push(`Les ${spot}s promis au téléphone ou au comptoir se bloquent en un clic : jamais de double réservation.`);
  if (a.sell.includes("platform")) out.push(`Zéro commission : l'argent des clients arrive directement sur votre compte.`);
  if (a.goals.includes("live")) out.push(`« Ce soir » : le plan de la soirée en direct, arrivées et absences en un geste.`);
  if (a.goals.includes("brand") || out.length < 3) out.push(`Votre plan en 3D, à vos couleurs, posé sur votre site en une ligne de code.`);
  if (a.size === "gt25") out.push(`Un plan qui zoome pour les grandes salles : chaque ${spot} reste lisible, même sur téléphone.`);
  return out.slice(0, 5);
}

export default function Onboarding({ look, google }: { look: Look; google: boolean }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({
    kind: look.kind ?? "", club: look.club ?? "", city: look.city ?? "", size: "", sell: [], goals: [],
  });
  const [state, formAction, pending] = useActionState<FormState, FormData>(signup, undefined);
  const set = (p: Partial<Answers>) => setA((x) => ({ ...x, ...p }));
  const toggle = (k: "sell" | "goals", v: string) => setA((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const TOTAL = 5; // questions avant le plan
  const name = a.club.trim() || "votre club";
  // Ce qui part avec le formulaire : réglages de la page d'accueil + réponses.
  const fields: Look = {
    ...look,
    club: a.club.trim() || undefined, city: a.city.trim() || undefined,
    kind: a.kind === "beach" ? "beach" : a.kind ? "club" : undefined,
    size: a.size || undefined, sell: a.sell.join(",") || undefined, goals: a.goals.join(",") || undefined,
  };
  const hidden = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={`look_${k}`} value={v} />);

  const Choice = ({ on, onClick, t, s }: { on: boolean; onClick: () => void; t: string; s?: string }) => (
    <button type="button" className={`ob-choice ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on}>
      <span className="ob-tick" aria-hidden="true" /><span><b>{t}</b>{s && <small>{s}</small>}</span>
    </button>
  );

  return (
    <main className="ob">
      <header className="ob-top">
        <Link href="/" className="logo"><i />tablo</Link>
        {step < TOTAL && <span className="mute">Question {step + 1} sur {TOTAL}</span>}
        <Link href="/connexion" className="mute ob-login">Déjà un compte ?</Link>
      </header>
      <div className="ob-bar"><i style={{ width: `${Math.min(100, (step / (TOTAL + 1)) * 100)}%` }} /></div>

      <div className="ob-body">
        <section className="ob-main">
          {step === 0 && (
            <>
              <span className="ob-badge"><b>1 minute</b>On prépare l&apos;espace de votre club</span>
              <h1>Vous gérez quel type de lieu&nbsp;?</h1>
              <div className="ob-choices">
                {KINDS.map((k) => <Choice key={k.v} on={a.kind === k.v} t={k.t} s={k.s} onClick={() => { set({ kind: k.v }); go(1); }} />)}
              </div>
            </>
          )}

          {step === 1 && (
            <form className="ob-form" onSubmit={(e) => { e.preventDefault(); if (a.club.trim().length >= 2) go(2); }}>
              <h1>Comment s&apos;appelle votre établissement&nbsp;?</h1>
              <label className="field">Nom<input className="input" autoFocus value={a.club} maxLength={60} placeholder="Ex. Le Velours" onChange={(e) => set({ club: e.target.value })} /></label>
              <label className="field">Ville<input className="input" value={a.city} maxLength={60} placeholder="Ex. Rouen" onChange={(e) => set({ city: e.target.value })} /></label>
              <div className="ob-nav">
                <button type="button" className="btn btn-out" onClick={() => go(0)}>Retour</button>
                <button className="btn btn-main" disabled={a.club.trim().length < 2}>Continuer</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <>
              <h1>Combien de {a.kind === "beach" ? "cabanas et emplacements" : "carrés VIP"} avez-vous&nbsp;?</h1>
              <div className="ob-choices">
                {SIZES.map((s) => <Choice key={s.v} on={a.size === s.v} t={s.t} onClick={() => { set({ size: s.v }); go(3); }} />)}
              </div>
              <div className="ob-nav"><button type="button" className="btn btn-out" onClick={() => go(1)}>Retour</button></div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Aujourd&apos;hui, comment vos clients réservent-ils&nbsp;?</h1>
              <p className="mute">Plusieurs réponses possibles.</p>
              <div className="ob-choices">
                {SELL.map((s) => <Choice key={s.v} on={a.sell.includes(s.v)} t={s.t} onClick={() => toggle("sell", s.v)} />)}
              </div>
              <div className="ob-nav">
                <button type="button" className="btn btn-out" onClick={() => go(2)}>Retour</button>
                <button type="button" className="btn btn-main" disabled={!a.sell.length} onClick={() => go(4)}>Continuer</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>Qu&apos;est-ce qui compterait le plus pour vous&nbsp;?</h1>
              <p className="mute">Choisissez ce qui vous parle, on construit votre plan avec.</p>
              <div className="ob-choices">
                {GOALS.map((g) => <Choice key={g.v} on={a.goals.includes(g.v)} t={g.t} onClick={() => toggle("goals", g.v)} />)}
              </div>
              <div className="ob-nav">
                <button type="button" className="btn btn-out" onClick={() => go(3)}>Retour</button>
                <button type="button" className="btn btn-main" disabled={!a.goals.length} onClick={() => go(5)}>Voir mon plan</button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <span className="ob-badge"><b>Votre plan</b>Construit avec vos réponses</span>
              <h1>Voici ce que Tablo change pour <span className="holo">{name}</span>.</h1>
              <ul className="ob-plan">{plan(a).map((l) => <li key={l}>{l}</li>)}</ul>
              <p className="mute ob-next">Prochaine étape : on configure ensemble votre espace (ambiance, {a.kind === "beach" ? "emplacements" : "carrés"}, bouteilles, shows, première soirée). Vous mettez en ligne quand tout est prêt.</p>
              <div className="ob-nav">
                <button type="button" className="btn btn-out" onClick={() => go(4)}>Retour</button>
                <button type="button" className="btn btn-main" onClick={() => go(6)}>Créer mon espace</button>
              </div>
            </>
          )}

          {step === 6 && (
            <form action={formAction} className="ob-form">
              <p className="ob-eyebrow">Dernière étape avant la configuration</p>
              <h1>Votre accès à l&apos;espace de <span className="holo">{name}</span></h1>
              {hidden}
              <label className="field">Votre nom<input className="input" name="name" autoComplete="name" required autoFocus /></label>
              <label className="field">Email<input className="input" type="email" name="email" autoComplete="email" required /></label>
              <label className="field">Mot de passe<input className="input" type="password" name="password" autoComplete="new-password" required minLength={8} /></label>
              {state?.error && <p className="err" role="alert">{state.error}</p>}
              <button className="btn btn-main" disabled={pending}>{pending ? "Un instant…" : "Créer mon accès"}</button>
              <p className="consent">En créant votre accès, vous acceptez les <Link href="/cgv" target="_blank">conditions générales de vente</Link> et la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>. Rien à payer avant la mise en ligne.</p>
              {google && (
                <>
                  <div className="sep-or"><span>ou</span></div>
                  <button className="btn btn-out btn-google" formAction={googleWithLook} formNoValidate>Continuer avec Google</button>
                </>
              )}
              <button type="button" className="btn btn-out" style={{ justifySelf: "start" }} onClick={() => go(5)}>Retour</button>
            </form>
          )}
        </section>

        {/* Ce qui se construit au fil des réponses */}
        <aside className="ob-side" aria-label="Votre espace">
          <span className="mute">Votre espace</span>
          <b className="ob-name">{a.club.trim() || "Votre club"}</b>
          <span className="mute">{[KINDS.find((k) => k.v === a.kind)?.t, a.city.trim()].filter(Boolean).join(" · ") || "Type de lieu, ville"}</span>
          <ul>
            <li className={a.kind ? "ok" : ""}>Type de lieu</li>
            <li className={a.club.trim() ? "ok" : ""}>Nom et ville</li>
            <li className={a.size ? "ok" : ""}>{a.size ? `${SIZES.find((s) => s.v === a.size)?.t} ${a.kind === "beach" ? "emplacements" : "carrés"}` : "Nombre de carrés"}</li>
            <li className={a.sell.length ? "ok" : ""}>Comment vous vendez</li>
            <li className={a.goals.length ? "ok" : ""}>Vos priorités</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
