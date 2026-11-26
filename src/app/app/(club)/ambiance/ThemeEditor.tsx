"use client";

import { useRef, useState, useTransition } from "react";
import { saveTheme } from "@/app/actions/club";
import { ALL_FONTS, AMBIANCES, COLOR_PARTS, GRADIENTS, MAX_LAYERS, MODES, themeVars, type ColorKey, type Layer, type Theme } from "@/lib/theme";
import Plan3D from "@/app/w/[slug]/Plan3D";
import Decor, { layerStyle } from "@/app/w/Decor";
import ColorPicker from "@/components/ColorPicker";
import { FontPicker, RadiusPicker, btnRadiusOf, themeColors, uiRadiusOf } from "@/components/ThemeControls";
import { cutout } from "@/lib/cutout";
import { samplePlan as SAMPLE } from "@/lib/sample-plan";
import "@/app/w/widget.css";

/** Couleur montrée dans le sélecteur quand une partie suit l'ambiance. */
function autoColor(t: Theme, k: ColorKey): string {
  const m = MODES[t.mode] ?? MODES.dark;
  const hex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : "#ffffff");
  if (k === "bg") return m.bg;
  if (k === "panel") return m.panel;
  if (k === "ink") return m.ink;
  if (k === "btn2") return t.colors?.btn1 ?? hex(t.accent);
  return hex(t.accent);
}

const uid = () => Math.random().toString(36).slice(2, 10);

export default function ThemeEditor({ initial, venueName, kind = "club" }: { initial: Theme; venueName: string; kind?: string }) {
  const [pick, setPick] = useState<string | null>("c");
  const [t, setT] = useState<Theme>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const [device, setDevice] = useState<"desk" | "phone">("desk");
  const [sel, setSel] = useState<string | null>(null);
  const [detour, setDetour] = useState(true);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Theme>) => { setT((x) => ({ ...x, ...patch, amb: "amb" in patch ? (patch.amb as string) : "perso" })); setMsg(undefined); };
  const layers = t.layers ?? [];
  const setLayers = (l: Layer[]) => set({ layers: l });
  const patchLayer = (id: string, p: Partial<Layer>) => setLayers(layers.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const current = layers.find((l) => l.id === sel);

  const onLogo = (f?: File) => {
    if (!f) return;
    if (f.size > 400_000) { setMsg({ error: "Logo trop lourd : 400 Ko maximum (PNG ou SVG conseillé)." }); return; }
    const r = new FileReader();
    r.onload = () => set({ logoUrl: String(r.result) });
    r.readAsDataURL(f);
  };

  const addImage = async (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setMsg({ error: "Image au format PNG, JPG ou WebP." }); return; }
    if (layers.length >= MAX_LAYERS) { setMsg({ error: `${MAX_LAYERS} éléments maximum.` }); return; }
    setBusy(true);
    try {
      const r = await cutout(f, { remove: detour });
      const l: Layer = { id: uid(), kind: "img", src: r.url, size: 22, x: 80, y: 72, rot: 0, opacity: 1 };
      setLayers([...layers, l]);
      setSel(l.id);
      setMsg(r.note ? { error: r.note } : r.removed ? { ok: "Fond retiré. Faites glisser l'image dans l'aperçu pour la placer." } : undefined);
    } catch {
      setMsg({ error: "Image illisible." });
    } finally { setBusy(false); }
  };
  const addText = () => {
    if (layers.length >= MAX_LAYERS) { setMsg({ error: `${MAX_LAYERS} éléments maximum.` }); return; }
    const l: Layer = { id: uid(), kind: "text", text: "VIP", font: t.head, color: t.accent, size: 10, x: 82, y: 22, rot: -8, opacity: 0.9 };
    setLayers([...layers, l]);
    setSel(l.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = layers.findIndex((l) => l.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= layers.length) return;
    const n = [...layers]; [n[i], n[j]] = [n[j], n[i]]; setLayers(n);
  };

  // Glisser un élément dans l'aperçu : la position est enregistrée en % de l'écran.
  const startDrag = (id: string) => (e: React.PointerEvent) => {
    const el = frame.current;
    if (!el) return;
    e.preventDefault();
    setSel(id);
    const r = el.getBoundingClientRect();
    const l = layers.find((x) => x.id === id)!;
    const ox = e.clientX, oy = e.clientY, sx = l.x, sy = l.y;
    const mv = (ev: PointerEvent) => {
      const x = Math.round((sx + ((ev.clientX - ox) / r.width) * 100) * 10) / 10;
      const y = Math.round((sy + ((ev.clientY - oy) / r.height) * 100) * 10) / 10;
      setT((th) => ({ ...th, amb: "perso", layers: (th.layers ?? []).map((q) => (q.id === id ? { ...q, x: Math.min(110, Math.max(-10, x)), y: Math.min(110, Math.max(-10, y)) } : q)) }));
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  const tc = themeColors(t);

  return (
    <div className="te">
      <div className="te-ctrl">
        <section className="card te-sec">
          <h2>Ambiance de départ</h2>
          <div className="ambs">
            {Object.values(AMBIANCES).map((a) => (
              <button type="button" key={a.amb} className={`amb ${t.amb === a.amb ? "on" : ""}`}
                onClick={() => set({ amb: a.amb, accent: a.accent, grad: a.grad, mode: a.mode, font: a.font, head: a.head, btn: a.btn, colors: {}, btnRadius: undefined, uiRadius: undefined })}>
                <span className="sw" style={{ background: a.swatch }}><em style={{ fontFamily: `'${a.head}'`, color: a.accent === "#16141a" ? "#16141a" : a.amb === "pool" ? "#fff" : a.accent }}>Aa</em></span>
                {a.name}<small>{a.desc}</small>
              </button>
            ))}
          </div>
          <p className="mute te-note">Une ambiance règle tout d&apos;un coup. Ensuite, chaque détail se change ci-dessous.</p>
        </section>

        <section className="card te-sec">
          <h2>Marque et textes</h2>
          <label className="field">Logo (PNG transparent ou SVG, 400 Ko max)
            <input className="input" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
          {t.logoUrl && <button type="button" className="btn btn-danger" style={{ justifySelf: "start" }} onClick={() => set({ logoUrl: null })}>Retirer le logo</button>}
          <label className="field">Phrase d&apos;accueil <small className="mute">(sous votre nom, en haut de la réservation)</small>
            <input className="input" maxLength={90} placeholder="Ex. : Les plus belles nuits de Rouen, depuis 2009." value={t.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} />
          </label>
          <label className="field">Texte du bouton sur votre site<input className="input" maxLength={28} value={t.fab} onChange={(e) => set({ fab: e.target.value })} /></label>
        </section>

        <section className="card te-sec">
          <h2>Polices</h2>
          <div className="field">Titres<FontPicker value={t.head} onChange={(f) => set({ head: f })} /></div>
          <div className="field">Textes<FontPicker kind="text" value={t.font} onChange={(f) => set({ font: f })} /></div>
        </section>

        <section className="card te-sec">
          <h2>Couleurs</h2>
          <div className="colorpart on">
            <ColorPicker value={t.accent} onChange={(c) => set({ accent: c })} themeColors={tc} label="Couleur principale" />
            <span><b>Couleur principale</b><small>Sélection, prix, titres si vous ne les changez pas</small></span>
          </div>
          <div className="field">Fond
            <div className="seg">{Object.entries(MODES).map(([k, m]) => <button type="button" key={k} className={t.mode === k ? "on" : ""} onClick={() => set({ mode: k as Theme["mode"] })}>{m.label}</button>)}</div>
          </div>
          <div className="field">Boutons
            <div className="seg">
              <button type="button" className={t.grad === "" ? "on" : ""} onClick={() => set({ grad: "" })}>Couleur unie</button>
              {Object.entries(GRADIENTS).map(([k, g]) => <button type="button" key={k} className={t.grad === k ? "on" : ""} onClick={() => set({ grad: k as Theme["grad"] })}>{g.label}</button>)}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <b style={{ fontSize: 14 }}>Partie par partie</b>
            {Object.keys(t.colors ?? {}).length > 0 && <button type="button" className="btn btn-out" onClick={() => set({ colors: {} })}>Tout remettre en auto</button>}
          </div>
          <div className="colorparts">
            {COLOR_PARTS.map((p) => {
              const v = t.colors?.[p.key as ColorKey];
              return (
                <div key={p.key} className={`colorpart ${v ? "on" : ""}`}>
                  <ColorPicker size="sm" value={v ?? autoColor(t, p.key as ColorKey)} auto={!v} themeColors={tc} label={p.label}
                    onChange={(c) => set({ colors: { ...(t.colors ?? {}), [p.key]: c } })} />
                  <span><b>{p.label}</b><small>{p.hint}</small></span>
                  {v && <button type="button" className="btn btn-out" onClick={() => { const c = { ...(t.colors ?? {}) }; delete c[p.key as ColorKey]; set({ colors: c }); }}>Auto</button>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card te-sec">
          <h2>Formes</h2>
          <RadiusPicker label="Arrondi des boutons" sample="btn" max={30} value={btnRadiusOf(t)} onChange={(v) => set({ btnRadius: v })} />
          <RadiusPicker label="Arrondi de l'interface (cartes, plan, champs)" sample="card" max={28} value={uiRadiusOf(t)} onChange={(v) => set({ uiRadius: v })} />
        </section>

        <section className="card te-sec">
          <h2>Images et textes en arrière-plan</h2>
          <p className="mute te-note">Ajoutez une bouteille, votre mascotte, un motif ou un mot. Le fond des images est retiré automatiquement ; faites glisser chaque élément dans l&apos;aperçu pour le placer.</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <label className={`btn btn-out ${busy ? "is-busy" : ""}`}>
              {busy ? "Détourage…" : "+ Image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy} onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button type="button" className="btn btn-out" onClick={addText}>+ Texte</button>
            <label className="te-check"><input type="checkbox" checked={detour} onChange={(e) => setDetour(e.target.checked)} /> Retirer le fond des images</label>
          </div>
          {layers.length > 0 && (
            <div className="te-layers">
              {[...layers].reverse().map((l) => (
                <button type="button" key={l.id} className={`te-layer ${sel === l.id ? "on" : ""}`} onClick={() => setSel(l.id)}>
                  {l.kind === "img" ? <img src={l.src} alt="" /> : <i style={{ fontFamily: `'${l.font}'`, color: l.color }}>T</i>}
                  <span>{l.kind === "img" ? "Image" : l.text || "Texte"}</span>
                </button>
              ))}
            </div>
          )}
          {current && (
            <div className="te-props">
              {current.kind === "text" && (
                <>
                  <label className="field">Texte<input className="input" maxLength={60} value={current.text ?? ""} onChange={(e) => patchLayer(current.id, { text: e.target.value })} /></label>
                  <div className="grid2">
                    <label className="field">Police<select className="select" value={current.font} onChange={(e) => patchLayer(current.id, { font: e.target.value })}>{ALL_FONTS.map((f) => <option key={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}</select></label>
                    <div className="field">Couleur<ColorPicker value={current.color ?? "#ffffff"} onChange={(c) => patchLayer(current.id, { color: c })} themeColors={tc} label="Couleur du texte" /></div>
                  </div>
                </>
              )}
              <label className="field">Taille<input type="range" min={current.kind === "img" ? 4 : 2} max={current.kind === "img" ? 90 : 26} step={0.5} value={current.size} onChange={(e) => patchLayer(current.id, { size: Number(e.target.value) })} /></label>
              <label className="field">Rotation<input type="range" min={-180} max={180} value={current.rot} onChange={(e) => patchLayer(current.id, { rot: Number(e.target.value) })} /></label>
              <label className="field">Opacité<input type="range" min={0.05} max={1} step={0.05} value={current.opacity} onChange={(e) => patchLayer(current.id, { opacity: Number(e.target.value) })} /></label>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <button type="button" className="btn btn-out" onClick={() => move(current.id, 1)}>Vers l&apos;avant</button>
                <button type="button" className="btn btn-out" onClick={() => move(current.id, -1)}>Vers l&apos;arrière</button>
                <button type="button" className="btn btn-danger" onClick={() => { setLayers(layers.filter((l) => l.id !== current.id)); setSel(null); }}>Supprimer</button>
              </div>
            </div>
          )}
        </section>

        <div className="row te-save">
          <button className="btn btn-main" disabled={pending || busy} onClick={() => start(async () => setMsg(await saveTheme(t)))}>{pending ? "Enregistrement…" : "Enregistrer l'ambiance"}</button>
          {msg?.error && <span className="err">{msg.error}</span>}
          {msg?.ok && <span className="okmsg">{msg.ok}</span>}
        </div>
      </div>

      <aside className="te-prev">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="mute" style={{ fontSize: 13 }}>Aperçu en direct</span>
          <div className="seg">
            <button type="button" className={device === "desk" ? "on" : ""} onClick={() => setDevice("desk")}>Ordinateur</button>
            <button type="button" className={device === "phone" ? "on" : ""} onClick={() => setDevice("phone")}>Téléphone</button>
          </div>
        </div>
        <div ref={frame} className={`tp-frame ${device}`} style={themeVars(t) as React.CSSProperties} onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <Decor layers={layers} className="w-deco tp-deco" />
          <div className="tp-main">
            <div className="tp-top">
              {t.logoUrl ? <img src={t.logoUrl} alt={venueName} /> : <b style={{ fontFamily: "var(--w-head)" }}>{venueName}</b>}
              <span>1 · 2 · 3 · 4 · 5</span>
            </div>
            {t.tagline && <p className="w-tagline" style={{ margin: 0, fontSize: 12 }}>{t.tagline}</p>}
            <div className="tp-title">Choisissez votre {kind === "beach" ? "emplacement" : "carré"}</div>
            <Plan3D planImageUrl={null} wallColor={null} tilt={50} beach={kind === "beach"} selected={pick} onSelect={setPick} boxes={SAMPLE(kind)} />
          </div>
          <div className="tp-side">
            <div className="tp-card"><span>Carré Prestige · 8 pers.</span><b>dès 1 500 €</b><small>Acompte 50 %</small></div>
            <div className="tp-btn">Continuer</div>
            <div className="tp-fab">{t.fab || "Réserver"}</div>
          </div>
          <div className="tp-edit">
            {layers.map((l) => (
              <div key={l.id} className={`tp-handle ${sel === l.id ? "on" : ""} ${l.kind}`} style={{ ...layerStyle(l), opacity: 1 }} onPointerDown={startDrag(l.id)}>
                {l.kind === "img" ? <img src={l.src} alt="" draggable={false} /> : <span>{l.text}</span>}
              </div>
            ))}
          </div>
        </div>
        <p className="mute te-note">Faites glisser les images et les textes pour les placer. Ils restent derrière la réservation : jamais par-dessus un bouton.</p>
      </aside>
    </div>
  );
}
