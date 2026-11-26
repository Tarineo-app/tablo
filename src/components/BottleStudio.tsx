"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFromCatalog, addOwnBottle, saveBottle, setBottlePhoto } from "@/app/actions/bottles";
import { deleteBottle } from "@/app/actions/club";
import { CATALOG, FAMILIES } from "@/lib/catalog";
import { cutout } from "@/lib/cutout";

export type StudioBottle = {
  id: string; name: string; type: string | null; photoUrl: string | null; active: boolean; catalogId: string | null; flavors: string[];
  sizes: { id: string; label: string; volume: string; priceCents: number; stock: number | null }[];
};

const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const toCents = (v: string) => Math.round((Number(v.replace(/\s/g, "").replace(",", ".")) || 0) * 100);
const TYPES = ["Champagne", "Vodka", "Tequila", "Whisky", "Gin", "Rhum", "Cognac", "Liqueur", "Vin", "Sans alcool", "Autre"];

/** La carte des bouteilles : catalogue Tablo à ajouter d'un « + », la carte du club (prix, stock par soirée), et ses propres bouteilles. */
export default function BottleStudio({ bottles, compact = false }: { bottles: StudioBottle[]; compact?: boolean }) {
  const router = useRouter();
  const [fam, setFam] = useState<string>("Tout");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const onCard = useMemo(() => new Map(bottles.filter((b) => b.catalogId).map((b) => [b.catalogId!, b])), [bottles]);
  const list = CATALOG.filter((c) => (fam === "Tout" || c.family === fam) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));

  const add = (id: string) => start(async () => { const r = await addFromCatalog(id); setMsg(r); router.refresh(); });

  return (
    <div className="bs">
      <section className="bs-sec">
        <div className="bs-head">
          <div><h2>Catalogue Tablo</h2><p className="mute">Les bouteilles les plus demandées en carré, déjà photographiées et détourées. Un « + » et elles sont sur votre carte, aux prix conseillés que vous ajustez ensuite.</p></div>
          <input className="input bs-search" placeholder="Rechercher une bouteille" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher dans le catalogue" />
        </div>
        <div className="fp-tabs">{["Tout", ...FAMILIES].map((f) => <button type="button" key={f} className={fam === f ? "on" : ""} onClick={() => setFam(f)}>{f}</button>)}</div>
        <div className="bs-cat">
          {list.map((c) => {
            const have = onCard.get(c.id);
            return (
              <div key={c.id} className={`bs-item ${have?.active ? "have" : ""}`}>
                <div className="bs-img"><img src={c.image} alt="" loading="lazy" /></div>
                <b>{c.name}</b>
                <small>{c.type} · dès {euros(c.sizes[0].priceCents)} €</small>
                {have?.active
                  ? <span className="bs-on">✓ Sur votre carte</span>
                  : <button type="button" className="bs-plus" disabled={pending} onClick={() => add(c.id)} aria-label={`Ajouter ${c.name}`}>+</button>}
              </div>
            );
          })}
        </div>
        <p className="mute bs-note">Une bouteille qui manque au catalogue ? Ajoutez-la vous-même ci-dessous, avec votre photo : le fond est retiré automatiquement.</p>
      </section>

      {msg && <p className={msg.error ? "err" : "okmsg"} role="status">{msg.error ?? msg.ok}</p>}

      <section className="bs-sec">
        <h2>Votre carte {bottles.length > 0 && <span className="mute">· {bottles.filter((b) => b.active).length} en vente</span>}</h2>
        {bottles.length === 0 && <p className="mute">Aucune bouteille pour l&apos;instant : ajoutez-en depuis le catalogue ou créez la vôtre.</p>}
        <div className="bs-mine">{bottles.map((b) => <MyBottle key={b.id} b={b} compact={compact} onSaved={() => router.refresh()} />)}</div>
      </section>

      <OwnBottle onAdded={() => router.refresh()} />
    </div>
  );
}

function MyBottle({ b, compact, onSaved }: { b: StudioBottle; compact: boolean; onSaved: () => void }) {
  const [sizes, setSizes] = useState(b.sizes.map((s) => ({ ...s, price: euros(s.priceCents), stockTxt: s.stock === null ? "" : String(s.stock), remove: false })));
  const [active, setActive] = useState(b.active);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const patch = (i: number, p: Partial<(typeof sizes)[number]>) => { setSizes((x) => x.map((s, j) => (j === i ? { ...s, ...p } : s))); setDirty(true); setMsg(undefined); };

  const save = (nextActive = active) => start(async () => {
    const r = await saveBottle(b.id, {
      active: nextActive,
      sizes: sizes.map((s) => ({ id: s.id, priceCents: toCents(s.price), stock: s.stockTxt.trim() === "" ? null : Math.max(0, parseInt(s.stockTxt, 10) || 0), remove: s.remove })),
    });
    setMsg(r);
    if (r?.ok) { setDirty(false); onSaved(); }
  });
  const photo = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await cutout(f, { remove: true });
      const s = await setBottlePhoto(b.id, r.url);
      setMsg(s?.ok ? { ok: r.note ?? "Photo enregistrée." } : s);
      onSaved();
    } catch { setMsg({ error: "Image illisible." }); } finally { setBusy(false); }
  };

  return (
    <div className={`bs-row ${active ? "" : "off"}`}>
      <label className={`bs-thumb ${busy ? "is-busy" : ""}`} title="Changer la photo (le fond est retiré automatiquement)">
        {b.photoUrl ? <img src={b.photoUrl} alt="" /> : <span>+ Photo</span>}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { photo(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <div className="bs-main">
        <div className="bs-title">
          <span><b>{b.name}</b><small>{[b.type, b.catalogId ? "Catalogue Tablo" : "Votre bouteille", b.flavors.length ? b.flavors.join(", ") : ""].filter(Boolean).join(" · ")}</small></span>
          <span className="row" style={{ gap: 6 }}>
            <button type="button" className={`bs-toggle ${active ? "on" : ""}`} aria-pressed={active} onClick={() => { setActive(!active); save(!active); }} title={active ? "En stock : proposée aux clients" : "Pas en stock : cachée aux clients"}>{active ? "En stock" : "Pas en stock"}</button>
            {!compact && <button type="button" className="bs-x" aria-label={`Supprimer ${b.name}`} onClick={() => { if (window.confirm(`Retirer ${b.name} de votre carte ?`)) start(async () => { await deleteBottle(b.id); onSaved(); }); }}>✕</button>}
          </span>
        </div>
        <div className="bs-sizes">
          {sizes.map((s, i) => !s.remove && (
            <div key={s.id} className="bs-size">
              <span className="bs-fmt">{s.label}<small>{s.volume}</small></span>
              <label>Prix<span className="unit"><input className="input" inputMode="decimal" value={s.price} onChange={(e) => patch(i, { price: e.target.value })} aria-label={`Prix ${s.label}`} />€</span></label>
              <label>Stock par soirée<span className="unit"><input className="input" inputMode="numeric" placeholder="Illimité" value={s.stockTxt} onChange={(e) => patch(i, { stockTxt: e.target.value.replace(/[^0-9]/g, "") })} aria-label={`Stock ${s.label}`} /></span></label>
              {!compact && sizes.filter((x) => !x.remove).length > 1 && <button type="button" className="bs-x" onClick={() => patch(i, { remove: true })} aria-label={`Retirer le format ${s.label}`}>✕</button>}
            </div>
          ))}
        </div>
        {(dirty || msg) && (
          <div className="row" style={{ gap: 10 }}>
            {dirty && <button type="button" className="btn btn-main" disabled={pending} onClick={() => save()}>{pending ? "…" : "Enregistrer"}</button>}
            {msg?.error && <span className="err">{msg.error}</span>}
            {msg?.ok && !dirty && <span className="okmsg">{msg.ok}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function OwnBottle({ onAdded }: { onAdded: () => void }) {
  const [f, setF] = useState({ name: "", type: "Champagne", label: "Bouteille", volume: "75 cl", price: "", stock: "", flavors: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { const r = await cutout(file, { remove: true }); setPhoto(r.url); setNote(r.note ?? (r.removed ? "Fond retiré automatiquement." : undefined)); }
    catch { setNote("Image illisible."); } finally { setBusy(false); }
  };
  const submit = () => start(async () => {
    const r = await addOwnBottle({
      name: f.name, type: f.type, label: f.label, volume: f.volume, priceCents: toCents(f.price),
      stock: f.stock.trim() === "" ? null : parseInt(f.stock, 10) || 0,
      flavors: f.flavors.split(",").map((x) => x.trim()).filter(Boolean), photo,
    });
    setMsg(r);
    if (r?.ok) { setF({ ...f, name: "", price: "", stock: "", flavors: "" }); setPhoto(null); setNote(undefined); onAdded(); }
  });
  return (
    <section className="bs-sec card bs-own">
      <h2>Votre propre bouteille</h2>
      <div className="bs-ownrow">
        <label className={`bs-drop ${busy ? "is-busy" : ""}`}>
          {photo ? <img src={photo} alt="" /> : <span>{busy ? "Détourage…" : "Photo de la bouteille"}<small>PNG, JPG ou WebP · fond retiré tout seul</small></span>}
          <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <div className="bs-ownform">
          <label className="field">Nom<input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Cuvée du club" /></label>
          <label className="field">Type<select className="select" value={f.type} onChange={(e) => set({ type: e.target.value, volume: e.target.value === "Champagne" ? "75 cl" : "70 cl" })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field">Format<input className="input" value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="Classique, Magnum…" /></label>
          <label className="field">Contenance<input className="input" value={f.volume} onChange={(e) => set({ volume: e.target.value })} /></label>
          <label className="field">Prix (€)<input className="input" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} placeholder="180" /></label>
          <label className="field">Stock par soirée<input className="input" inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Illimité" /></label>
          <label className="field bs-wide">Goûts (facultatif, séparés par des virgules)<input className="input" value={f.flavors} onChange={(e) => set({ flavors: e.target.value })} placeholder="Original, Pêche, Ananas" /></label>
        </div>
      </div>
      {note && <p className="mute" style={{ margin: 0, fontSize: 13 }}>{note}</p>}
      <div className="row" style={{ gap: 12 }}>
        <button type="button" className="btn btn-main" disabled={pending || busy || !f.name.trim() || !f.price} onClick={submit}>{pending ? "…" : "Ajouter à ma carte"}</button>
        {msg?.error && <span className="err">{msg.error}</span>}
        {msg?.ok && <span className="okmsg">{msg.ok}</span>}
      </div>
    </section>
  );
}
