"use client";

import { useRef, useState, useTransition } from "react";
import { savePlan } from "@/app/actions/club";

type T = { id?: string; key: string; name: string; categoryId: string; capacity: number; minSpendCents: number | null; photoUrl: string | null; x: number; y: number; w: number; h: number };
type Cat = { id: string; name: string; minSpendCents: number; color: string | null; elevation: number };
type View3d = { plan3d: boolean; planTilt: number; wallColor: string | null; tour3dUrl: string | null };

const COLORS = ["#ff5fa2", "#a970ff", "#4fd8ff", "#b6ff6a", "#ffd25f", "#ff8a5f"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
let seq = 0;

/** Réduit l'image (1600 px max) pour que le plan reste léger. */
function compress(file: File, max = 1600): Promise<string> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = ko;
    img.src = URL.createObjectURL(file);
  });
}

export default function PlanEditor({ categories, initialImage, initialTables, view, slug }: { categories: Cat[]; initialImage: string | null; initialTables: Omit<T, "key">[]; view: View3d; slug: string }) {
  const [img, setImg] = useState(initialImage);
  const [v3, setV3] = useState<View3d>(view);
  const [tables, setTables] = useState<T[]>(initialTables.map((t) => ({ ...t, key: t.id ?? `n${seq++}` })));
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const color = (catId: string) => categories.find((c) => c.id === catId)?.color ?? COLORS[Math.max(0, categories.findIndex((c) => c.id === catId)) % COLORS.length];
  const cur = tables.find((t) => t.key === sel);
  const patch = (key: string, p: Partial<T>) => { setTables((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t))); setMsg(undefined); };

  const drag = (e: React.PointerEvent, t: T, mode: "move" | "size") => {
    e.stopPropagation();
    e.preventDefault();
    setSel(t.key);
    const r = box.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, o = { ...t };
    const mv = (ev: PointerEvent) => {
      const dx = ((ev.clientX - sx) / r.width) * 100, dy = ((ev.clientY - sy) / r.height) * 100;
      if (mode === "move") patch(t.key, { x: clamp(o.x + dx, 0, 100 - o.w), y: clamp(o.y + dy, 0, 100 - o.h) });
      else patch(t.key, { w: clamp(o.w + dx, 3, 100 - o.x), h: clamp(o.h + dy, 3, 100 - o.y) });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  };

  const add = () => {
    const key = `n${seq++}`;
    const n = tables.length + 1;
    setTables((ts) => [...ts, { key, name: `Carré ${n}`, categoryId: categories[0].id, capacity: 6, minSpendCents: null, photoUrl: null, x: 42, y: 40, w: 14, h: 12 }]);
    setSel(key);
  };

  const save = () =>
    start(async () => {
      const r = await savePlan({
        planImageUrl: img,
        tables: tables.map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, capacity: t.capacity, minSpendCents: t.minSpendCents, photoUrl: t.photoUrl, x: +t.x.toFixed(2), y: +t.y.toFixed(2), w: +t.w.toFixed(2), h: +t.h.toFixed(2) })),
        plan3d: v3.plan3d, planTilt: v3.planTilt, wallColor: v3.wallColor, tour3dUrl: v3.tour3dUrl,
      });
      setMsg(r ?? {});
    });

  return (
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(260px,.8fr)", alignItems: "start" }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div ref={box} className="planwrap" style={{ backgroundImage: img ? `url(${img})` : undefined }} onPointerDown={() => setSel(null)}>
          {!img && <div className="grid-bg" />}
          {tables.map((t) => (
            <div key={t.key} className={`ptable ${sel === t.key ? "sel" : ""}`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%`, borderColor: color(t.categoryId) }}
              onPointerDown={(e) => drag(e, t, "move")}>
              <span>{t.name}<br /><span style={{ color: color(t.categoryId), fontSize: 10 }}>{categories.find((c) => c.id === t.categoryId)?.name}</span></span>
              <span className="rs" onPointerDown={(e) => drag(e, t, "size")} />
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn btn-out" onClick={add}>+ Ajouter un carré</button>
          <label className="btn btn-out" style={{ cursor: "pointer" }}>Importer le plan (photo)
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImg(await compress(f)); }} />
          </label>
          {img && <button type="button" className="btn btn-danger" onClick={() => setImg(null)}>Retirer l&apos;image</button>}
        </div>
        <div className="row">
          <button type="button" className="btn btn-main" onClick={save} disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le plan"}</button>
          {msg?.error && <span className="err">{msg.error}</span>}
          {msg?.ok && <span className="okmsg">{msg.ok}</span>}
        </div>
      </div>

      <aside className="card" style={{ display: "grid", gap: 12 }}>
        {cur ? (
          <>
            <h2 style={{ fontSize: 16 }}>Carré sélectionné</h2>
            <label className="field">Nom<input className="input" value={cur.name} maxLength={30} onChange={(e) => patch(cur.key, { name: e.target.value })} /></label>
            <label className="field">Catégorie
              <select className="select" value={cur.categoryId} onChange={(e) => patch(cur.key, { categoryId: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">Capacité (personnes)<input className="input" type="number" min={1} max={100} value={cur.capacity} onChange={(e) => patch(cur.key, { capacity: Math.max(1, +e.target.value || 1) })} /></label>
            <label className="field">Minimum propre à ce carré (€, vide = celui de la catégorie)
              <input className="input" inputMode="decimal" value={cur.minSpendCents == null ? "" : cur.minSpendCents / 100}
                onChange={(e) => patch(cur.key, { minSpendCents: e.target.value.trim() === "" ? null : Math.round((+e.target.value.replace(",", ".") || 0) * 100) })} />
            </label>
            <div className="field">Photo du carré (vue en 3D et fiche client)
              {cur.photoUrl && <img src={cur.photoUrl} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12, marginTop: 6 }} />}
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <label className="btn btn-out" style={{ cursor: "pointer" }}>{cur.photoUrl ? "Changer" : "Importer une photo"}
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) patch(cur.key, { photoUrl: await compress(f, 900) }); }} />
                </label>
                {cur.photoUrl && <button type="button" className="btn btn-danger" onClick={() => patch(cur.key, { photoUrl: null })}>Retirer</button>}
              </div>
            </div>
            <button type="button" className="btn btn-danger" style={{ justifySelf: "start" }} onClick={() => { setTables((ts) => ts.filter((t) => t.key !== cur.key)); setSel(null); }}>Supprimer ce carré</button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 16 }}>{tables.length} carré(s)</h2>
            <p className="mute" style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }}>Cliquez sur un carré pour modifier son nom, sa catégorie, sa capacité et son minimum.</p>
            <div style={{ display: "grid", gap: 6 }}>
              {categories.map((c) => <span key={c.id} className="row" style={{ gap: 8, fontSize: 13 }}><i style={{ width: 12, height: 12, borderRadius: 4, background: color(c.id) }} />{c.name} · {tables.filter((t) => t.categoryId === c.id).length}</span>)}
            </div>
          </>
        )}

        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />
        <h2 style={{ fontSize: 16 }}>Vue 3D</h2>
        <p className="mute" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>Elle se fabrique toute seule : votre plan devient le sol, chaque carré est relevé à la hauteur de sa catégorie.</p>
        <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" checked={v3.plan3d} onChange={(e) => setV3({ ...v3, plan3d: e.target.checked })} /> Montrer le plan en 3D aux clients</label>
        <label className="field">Inclinaison : {v3.planTilt}°
          <input type="range" min={20} max={68} value={v3.planTilt} onChange={(e) => setV3({ ...v3, planTilt: +e.target.value })} />
        </label>
        <label className="field">Lien d&apos;une visite 3D (Matterport, Polycam…)
          <input className="input" value={v3.tour3dUrl ?? ""} placeholder="https://my.matterport.com/show/?m=…" onChange={(e) => setV3({ ...v3, tour3dUrl: e.target.value })} />
        </label>
        <a className="btn btn-out" href={`/w/${slug}`} target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>Voir le résultat ↗</a>
      </aside>
    </div>
  );
}
