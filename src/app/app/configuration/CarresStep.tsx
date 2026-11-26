"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { autoPlan } from "@/app/actions/setup";
import { addTable, analyzePlan, applyPlan, removeTable, setTablePhoto, updateTable, type FoundTable } from "@/app/actions/tables";
import type { ActionState } from "@/app/actions/club";
import { cutout } from "@/lib/cutout";
import type { SetupData } from "./Setup";

/** Réduit une image (plan ou photo) avant l'envoi, sans retirer le fond. Un plan garde plus de détails pour être lu. */
async function shrink(file: File, plan = false): Promise<string> {
  return (await cutout(file, plan ? { remove: false, maxSide: 1800, maxChars: 1_150_000 } : { remove: false, maxSide: 1200, maxChars: 900_000 })).url;
}

const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);

export default function CarresStep({ data, spot, onNext, onFocus }: { data: SetupData; spot: string; onNext: () => void; onFocus: (id: string | null) => void }) {
  const router = useRouter();
  const has = data.tables.length > 0;
  const [rows, setRows] = useState(data.cats.map((c, i) => ({ ...c, count: c.count || (has ? 0 : [2, 2, 4, 2][i] ?? 2) })));
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"quick" | "import">("quick");
  const patch = (i: number, p: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const save = () => start(async () => {
    const r = await autoPlan({ cats: rows.map((c) => ({ id: c.id, count: Math.round(c.count), minEuros: c.minEuros, depositPct: Math.round(c.depositPct), capacity: Math.max(1, Math.round(c.capacity)) })) });
    setMsg(r);
    if (r?.ok) router.refresh();
  });

  return (
    <>
      <h1>Vos {spot}s et leurs prix</h1>
      <div className="su-how">
        <b>Comment ça marche</b>
        <ol>
          <li><strong>Une catégorie</strong>, c&apos;est un type de {spot} avec un même prix : par exemple « Prestige », près de la scène. Le <em>minimum</em> est ce que le client s&apos;engage à consommer en bouteilles ; l&apos;<em>acompte</em> est la part payée en ligne pour bloquer le {spot}.</li>
          <li><strong>Chaque {spot}</strong> est un emplacement réel de votre salle : il a son nom (« Carré 12 », « Impérial »), ses places et sa photo. C&apos;est lui que le client choisit sur le plan.</li>
          <li><strong>Le plan</strong> : on le dessine pour vous, ou vous importez celui de votre salle et l&apos;IA repère vos {spot}s. Le téléphone à droite montre ce que voit votre client : touchez un {spot} pour voir sa fiche.</li>
        </ol>
      </div>

      <h2 className="su-h2">1. Catégories et prix</h2>
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

      {!has && (
        <>
          <h2 className="su-h2">2. Votre plan</h2>
          <div className="seg su-seg">
            <button type="button" className={mode === "quick" ? "on" : ""} onClick={() => setMode("quick")}>Plan dessiné pour moi</button>
            <button type="button" className={mode === "import" ? "on" : ""} onClick={() => setMode("import")}>Importer le plan de ma salle</button>
          </div>
          {mode === "quick" ? (
            <div className="row" style={{ gap: 12 }}>
              <button className="btn btn-main" disabled={pending} onClick={save}>{pending ? "Un instant…" : `Placer mes ${spot}s sur le plan`}</button>
              {msg?.error && <span className="err">{msg.error}</span>}
            </div>
          ) : (
            <PlanImport data={data} spot={spot} replace={false} beforeApply={save} />
          )}
        </>
      )}

      {has && (
        <>
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn-out" disabled={pending} onClick={save}>{pending ? "Un instant…" : "Enregistrer les prix"}</button>
            {msg?.error && <span className="err">{msg.error}</span>}
            {msg?.ok && <span className="okmsg">{msg.ok}</span>}
          </div>
          <h2 className="su-h2">2. Vos {spot}s, un par un</h2>
          <p className="mute su-p">Donnez à chaque {spot} son vrai nom et une photo : c&apos;est ce que le client voit quand il le touche sur le plan. Un {spot} vendu plus cher que sa catégorie ? Indiquez son propre minimum.</p>
          {data.cats.map((c) => {
            const list = data.tablesFull.filter((t) => t.categoryId === c.id);
            return (
              <div key={c.id} className="su-tcat">
                <div className="su-tcat-h"><span className="cat"><i style={{ background: c.color ?? "#a970ff" }} />{c.name}<small className="mute"> · {list.length} {spot}{list.length > 1 ? "s" : ""}</small></span>
                  <AddTable categoryId={c.id} label={`+ Ajouter un ${spot}`} />
                </div>
                {list.map((t) => <TableRow key={t.id} t={t} catMin={c.minEuros} spot={spot} onFocus={onFocus} />)}
              </div>
            );
          })}
          <details className="su-more">
            <summary>Importer le plan de ma salle (l&apos;IA repère les {spot}s)</summary>
            <PlanImport data={data} spot={spot} replace />
          </details>
          <p className="mute su-p">Pour déplacer ou redimensionner les {spot}s à la souris : <Link href="/app/plan" style={{ color: "inherit" }}>Plan des carrés</Link>.</p>
        </>
      )}

      <div className="su-nav"><span /><button className="btn btn-main" disabled={!has} onClick={onNext}>{has ? "Continuer" : `Placez d'abord vos ${spot}s`}</button></div>
    </>
  );
}

function AddTable({ categoryId, label }: { categoryId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" className="btn btn-out su-mini" disabled={pending} onClick={() => start(async () => { await addTable(categoryId); router.refresh(); })}>{pending ? "…" : label}</button>;
}

function TableRow({ t, catMin, spot, onFocus }: { t: SetupData["tablesFull"][number]; catMin: number; spot: string; onFocus: (id: string | null) => void }) {
  const router = useRouter();
  const [f, setF] = useState({ name: t.name, capacity: String(t.capacity), min: t.minCents === null ? "" : String(t.minCents / 100) });
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setDirty(true); setMsg(undefined); };
  const save = () => start(async () => {
    const r = await updateTable(t.id, { name: f.name, capacity: Math.max(1, parseInt(f.capacity, 10) || 1), minEuros: f.min.trim() === "" ? null : num(f.min) });
    setMsg(r);
    if (r?.ok) { setDirty(false); router.refresh(); }
  });
  const photo = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { const r = await shrink(file); const s = await setTablePhoto(t.id, r); setMsg(s); router.refresh(); }
    catch { setMsg({ error: "Image illisible." }); } finally { setBusy(false); }
  };
  return (
    <div className="su-trow" onFocus={() => onFocus(t.id)} onMouseEnter={() => onFocus(t.id)}>
      <label className={`su-tphoto ${busy ? "is-busy" : ""}`} title={`Photo du ${spot}`}>
        {t.photoUrl ? <img src={t.photoUrl} alt="" /> : <span>+ Photo</span>}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { photo(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <label className="su-tf">Nom<input className="input" value={f.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="su-tf sm">Places<input className="input" inputMode="numeric" value={f.capacity} onChange={(e) => set({ capacity: e.target.value.replace(/[^0-9]/g, "") })} /></label>
      <label className="su-tf sm">Minimum<span className="unit"><input className="input" inputMode="decimal" placeholder={String(catMin)} value={f.min} onChange={(e) => set({ min: e.target.value })} />€</span></label>
      <span className="su-tact">
        {dirty && <button type="button" className="btn btn-main su-mini" disabled={pending} onClick={save}>{pending ? "…" : "OK"}</button>}
        <button type="button" className="bs-x" aria-label={`Retirer ${t.name}`} onClick={() => { if (window.confirm(`Retirer ${t.name} du plan ?`)) start(async () => { const r = await removeTable(t.id); setMsg(r); router.refresh(); }); }}>✕</button>
      </span>
      {msg?.error && <span className="err su-terr">{msg.error}</span>}
    </div>
  );
}

/** Import du plan : l'IA repère les carrés, le club vérifie la liste, corrige, puis valide. */
function PlanImport({ data, spot, replace, beforeApply }: { data: SetupData; spot: string; replace: boolean; beforeApply?: () => void }) {
  const router = useRouter();
  const [img, setImg] = useState<string | null>(null);
  const [found, setFound] = useState<FoundTable[] | null>(null);
  const [msg, setMsg] = useState<ActionState & { note?: string }>();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const cats = data.cats.map((c) => c.name);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setMsg({ error: "Plan en image : PNG, JPG ou WebP (une capture d'écran d'un PDF marche très bien)." }); return; }
    setBusy(true); setFound(null); setMsg(undefined);
    try {
      const url = await shrink(file, true);
      setImg(url);
      const r = await analyzePlan(url);
      if ("error" in r) setMsg({ error: r.error });
      else { setFound(r.tables); setMsg({ ok: `${r.tables.length} ${spot}s repérés. Vérifiez la liste, corrigez si besoin, puis validez.`, note: r.note }); }
    } catch { setMsg({ error: "Image illisible." }); } finally { setBusy(false); }
  };
  const edit = (i: number, p: Partial<FoundTable>) => setFound((l) => l?.map((t, j) => (j === i ? { ...t, ...p } : t)) ?? null);
  const apply = () => start(async () => {
    if (!img) return;
    const r = await applyPlan({ image: img, replace, tables: found ?? [] });
    setMsg(r);
    // Prix des catégories enregistrés ensuite ; sans carrés repérés, le plan est dessiné sur l'image.
    if (r?.ok) { beforeApply?.(); setFound(null); router.refresh(); }
  });

  return (
    <div className="su-import">
      <label className={`su-drop ${busy ? "is-busy" : ""}`}>
        {img ? <img src={img} alt="Votre plan" /> : <span><b>Déposez le plan de votre salle</b><small>Photo, capture d&apos;écran ou dessin, vu de dessus. L&apos;IA repère vos {spot}s, leurs noms et leurs places.</small></span>}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {busy && <p className="mute" style={{ margin: 0 }}>L&apos;IA lit votre plan… (quelques secondes)</p>}
      {img && found && (
        <div className="su-found">
          <div className="su-foundimg">
            <img src={img} alt="" />
            {found.map((t, i) => <span key={i} style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }} title={t.name}>{t.name}</span>)}
          </div>
          <div className="su-foundlist">
            {found.map((t, i) => (
              <div key={i} className="su-frow">
                <input className="input" value={t.name} maxLength={30} onChange={(e) => edit(i, { name: e.target.value })} aria-label="Nom" />
                <select className="select" value={cats.find((c) => c.toLowerCase() === t.category.toLowerCase()) ?? cats[cats.length - 1]} onChange={(e) => edit(i, { category: e.target.value })} aria-label="Catégorie">{cats.map((c) => <option key={c}>{c}</option>)}</select>
                <input className="input" inputMode="numeric" value={t.seats} onChange={(e) => edit(i, { seats: Math.max(1, parseInt(e.target.value, 10) || 1) })} aria-label="Places" />
                <button type="button" className="bs-x" onClick={() => setFound((l) => l?.filter((_, j) => j !== i) ?? null)} aria-label={`Retirer ${t.name}`}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {msg?.note && <p className="mute" style={{ margin: 0, fontSize: 13 }}>{msg.note}</p>}
      {msg?.error && <p className="err" style={{ margin: 0 }}>{msg.error}</p>}
      {msg?.ok && <p className="okmsg" style={{ margin: 0 }}>{msg.ok}</p>}
      {img && (
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-main" disabled={pending || busy} onClick={apply}>
            {pending ? "…" : found?.length ? `Valider ces ${found.length} ${spot}s${replace ? " (remplace le plan actuel)" : ""}` : "Garder ce plan en fond"}
          </button>
          {!found?.length && <span className="mute" style={{ fontSize: 13 }}>Vos {spot}s seront posés dessus, à ajuster dans « Plan des carrés ».</span>}
        </div>
      )}
    </div>
  );
}
