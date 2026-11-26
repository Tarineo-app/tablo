"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSetupShows, removeShow, setShowPhoto, setShowPrice } from "@/app/actions/setup";
import type { ActionState } from "@/app/actions/club";
import { cutout } from "@/lib/cutout";
import type { SetupData } from "./Setup";

type Idea = { name: string; description: string; priceEuros: number; group: string };

/** Idées de shows, rangées par moment. Le club coche ce qu'il fait, met son prix et sa photo. */
const IDEAS: Record<"club" | "beach", Idea[]> = {
  club: [
    { group: "L'arrivée des bouteilles", name: "Parade sparklers", description: "Les bouteilles arrivent portées, sparklers allumés, au rythme de la musique", priceEuros: 60 },
    { group: "L'arrivée des bouteilles", name: "Mallette lumineuse", description: "La bouteille sort d'une mallette LED, sous un jet de fumée", priceEuros: 120 },
    { group: "L'arrivée des bouteilles", name: "Mètre de bouteilles", description: "Les bouteilles alignées sur un mètre lumineux aux couleurs du club", priceEuros: 200 },
    { group: "L'arrivée des bouteilles", name: "Couronne de bouteilles", description: "Les bouteilles servies sur une couronne lumineuse", priceEuros: 150 },
    { group: "Le moment fort", name: "Canon à confettis", description: "Explosion de confettis au-dessus du carré", priceEuros: 90 },
    { group: "Le moment fort", name: "Jets de CO2", description: "Colonnes de fumée froide lancées au moment choisi", priceEuros: 80 },
    { group: "Le moment fort", name: "Fontaines froides", description: "Gerbes d'étincelles sans flamme autour du carré", priceEuros: 90 },
    { group: "Le moment fort", name: "Danseurs à la table", description: "Un show de quelques minutes autour du carré", priceEuros: 150 },
    { group: "Personnalisé", name: "Annonce du DJ", description: "Le prénom du client annoncé au micro", priceEuros: 20 },
    { group: "Personnalisé", name: "Dédicace du DJ", description: "Le morceau du client joué à l'heure choisie", priceEuros: 30 },
    { group: "Personnalisé", name: "Photo sur l'écran LED", description: "La photo du client sur l'écran géant", priceEuros: 80 },
    { group: "Personnalisé", name: "Gâteau d'anniversaire", description: "Gâteau servi au carré avec bougies étincelles", priceEuros: 70 },
    { group: "Souvenir", name: "Photographe au carré", description: "Une série de photos de la table, envoyées le lendemain", priceEuros: 90 },
    { group: "Souvenir", name: "Polaroïds", description: "Dix polaroïds de la soirée à emporter", priceEuros: 40 },
  ],
  beach: [
    { group: "L'arrivée des bouteilles", name: "Parade sparklers", description: "Les bouteilles arrivent portées, sparklers allumés", priceEuros: 60 },
    { group: "L'arrivée des bouteilles", name: "Seau géant lumineux", description: "Bouteilles servies dans un seau à glace lumineux", priceEuros: 50 },
    { group: "Le moment fort", name: "Fumigènes colorés", description: "Fumée de couleur pour la photo de groupe", priceEuros: 60 },
    { group: "Le moment fort", name: "Canon à confettis", description: "Explosion de confettis au-dessus de l'emplacement", priceEuros: 90 },
    { group: "Le moment fort", name: "Danseurs et percussions", description: "Un show de quelques minutes autour de l'emplacement", priceEuros: 150 },
    { group: "Personnalisé", name: "Annonce du DJ", description: "Le prénom du client annoncé au micro", priceEuros: 20 },
    { group: "Personnalisé", name: "Gâteau d'anniversaire", description: "Gâteau servi avec bougies étincelles", priceEuros: 70 },
    { group: "Gourmand", name: "Plateau de fruits", description: "Fruits frais servis avec les bouteilles", priceEuros: 45 },
    { group: "Gourmand", name: "Plateau de sushis", description: "Assortiment à partager, servi à l'emplacement", priceEuros: 90 },
    { group: "Souvenir", name: "Photographe", description: "Une série de photos du groupe, envoyées le lendemain", priceEuros: 90 },
  ],
};

async function shrink(file: File) {
  return (await cutout(file, { remove: false, maxSide: 1200, maxChars: 900_000 })).url;
}

export default function ShowsStep({ data, spot, onBack, onNext }: { data: SetupData; spot: string; onBack: () => void; onNext: () => void }) {
  const router = useRouter();
  const have = new Set(data.shows.map((s) => s.name.toLowerCase()));
  const ideas = IDEAS[data.venue.kind].filter((s) => !have.has(s.name.toLowerCase()));
  const groups = [...new Set(ideas.map((i) => i.group))];
  const [sel, setSel] = useState<Record<string, { on: boolean; price: number; photo: string | null }>>({});
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const chosen = ideas.filter((i) => sel[i.name]?.on);
  const toggle = (i: Idea) => setSel((x) => ({ ...x, [i.name]: { on: !x[i.name]?.on, price: x[i.name]?.price ?? i.priceEuros, photo: x[i.name]?.photo ?? null } }));
  const add = () => start(async () => {
    const r = await addSetupShows(chosen.map((i) => ({ name: i.name, description: i.description, priceEuros: sel[i.name].price, photo: sel[i.name].photo })));
    setMsg(r);
    if (r?.ok) { setSel({}); router.refresh(); }
  });
  const shows = data.shows.filter((s) => !s.isSign);

  return (
    <>
      <h1>Vos shows</h1>
      <p className="mute">C&apos;est ce qui fait grimper le panier : ils sont proposés au client pendant qu&apos;il réserve son {spot}, <strong>avec leur photo</strong>. Une vraie photo de vos shows vend bien mieux qu&apos;une description.</p>

      {shows.length > 0 && (
        <>
          <h2 className="su-h2">Sur votre carte</h2>
          <div className="su-mshows">{shows.map((s) => <MyShow key={s.id} s={s} />)}</div>
        </>
      )}

      <h2 className="su-h2">Créer votre show</h2>
      <CustomShow onAdded={() => router.refresh()} />

      {ideas.length > 0 && (
        <>
          <h2 className="su-h2">Des idées, prêtes à ajouter</h2>
          {groups.map((g) => (
            <div key={g} className="su-igroup">
              <b className="su-igh">{g}</b>
              <div className="su-ideas">
                {ideas.filter((i) => i.group === g).map((i) => {
                  const st = sel[i.name];
                  return (
                    <div key={i.name} className={`su-idea ${st?.on ? "on" : ""}`}>
                      <button type="button" className="su-ideabtn" onClick={() => toggle(i)} aria-pressed={!!st?.on}>
                        <span className="ob-tick" aria-hidden="true" /><span><b>{i.name}</b><small>{i.description}</small></span>
                      </button>
                      {st?.on && (
                        <div className="su-ideaset">
                          <span className="unit"><input className="input" inputMode="decimal" value={st.price} onChange={(e) => setSel((x) => ({ ...x, [i.name]: { ...st, price: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) } }))} aria-label={`Prix ${i.name}`} />€</span>
                          <label className="btn btn-out su-mini">{st.photo ? "Photo ✓" : "+ Photo"}<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const p = await shrink(f); setSel((x) => ({ ...x, [i.name]: { ...x[i.name], photo: p } })); } }} /></label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn-main" disabled={pending || !chosen.length} onClick={add}>{pending ? "…" : chosen.length ? `Ajouter ${chosen.length} show${chosen.length > 1 ? "s" : ""} à ma carte` : "Cochez vos shows"}</button>
            {msg?.error && <span className="err">{msg.error}</span>}
            {msg?.ok && <span className="okmsg">{msg.ok}</span>}
          </div>
        </>
      )}

      <div className="su-nav">
        <button className="btn btn-out" onClick={onBack}>Retour</button>
        <button className="btn btn-main" disabled={!shows.length} onClick={onNext}>{shows.length ? "Continuer : la pancarte" : "Ajoutez au moins un show"}</button>
      </div>
    </>
  );
}

function MyShow({ s }: { s: SetupData["shows"][number] }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(s.price));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const photo = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const r = await setShowPhoto(s.id, await shrink(f)); setMsg(r); router.refresh(); } catch { setMsg({ error: "Image illisible." }); } finally { setBusy(false); }
  };
  return (
    <div className="su-mshow">
      <label className={`su-mphoto ${busy ? "is-busy" : ""}`} title="Photo du show">
        {s.mediaUrl ? <img src={s.mediaUrl} alt="" /> : <span>+ Photo</span>}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { photo(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <span className="su-mtxt"><b>{s.name}</b><small>{s.description}</small>{!s.mediaUrl && <em>Ajoutez une photo : c&apos;est ce qui fait vendre.</em>}</span>
      <span className="unit"><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
        onBlur={() => { const v = Number(price.replace(",", ".")) || 0; if (v !== s.price) start(async () => { setMsg(await setShowPrice(s.id, v)); router.refresh(); }); }} aria-label={`Prix ${s.name}`} />€</span>
      <button type="button" className="bs-x" disabled={pending} aria-label={`Retirer ${s.name}`} onClick={() => { if (window.confirm(`Retirer « ${s.name} » ?`)) start(async () => { await removeShow(s.id); router.refresh(); }); }}>✕</button>
      {msg?.error && <span className="err" style={{ gridColumn: "1 / -1" }}>{msg.error}</span>}
    </div>
  );
}

function CustomShow({ onAdded }: { onAdded: () => void }) {
  const [f, setF] = useState({ name: "", description: "", price: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    const r = await addSetupShows([{ name: f.name, description: f.description, priceEuros: Math.max(0, Number(f.price.replace(",", ".")) || 0), photo }]);
    setMsg(r);
    if (r?.ok) { setF({ name: "", description: "", price: "" }); setPhoto(null); onAdded(); }
  });
  return (
    <div className="card su-custom">
      <label className="su-cphoto">
        {photo ? <img src={photo} alt="" /> : <span><b>+ Photo du show</b><small>La vraie, prise pendant une soirée</small></span>}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setPhoto(await shrink(file)); e.target.value = ""; }} />
      </label>
      <div className="su-cform">
        <label className="field">Nom du show<input className="input" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. L'Impériale du Velours" /></label>
        <label className="field">Ce que vit le client<input className="input" maxLength={160} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex. Trois bouteilles portées sous les lasers, avec votre prénom sur l'écran" /></label>
        <div className="row" style={{ gap: 10, alignItems: "end" }}>
          <label className="field" style={{ maxWidth: 140 }}>Prix<span className="unit"><input className="input" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0 = offert" />€</span></label>
          <button type="button" className="btn btn-main" disabled={pending || f.name.trim().length < 2} onClick={submit}>{pending ? "…" : "Ajouter mon show"}</button>
        </div>
        {msg?.error && <span className="err">{msg.error}</span>}
        {msg?.ok && <span className="okmsg">{msg.ok}</span>}
      </div>
    </div>
  );
}
