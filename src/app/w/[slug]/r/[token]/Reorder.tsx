"use client";

import { useMemo, useState, useTransition } from "react";
import { askManager, reorder } from "@/app/actions/reorder";
import { eur } from "@/lib/money";

type Opt = { id: string; label: string; priceCents: number; kind: "bottle" | "show"; flavors: string[] };
type Line = { key: string; id: string; flavor: string | null; quantity: number };

/** Commander en cours de soirée, depuis la table. */
export default function Reorder({ token, options, hasManager }: { token: string; options: Opt[]; hasManager: boolean }) {
  const [tab, setTab] = useState<"order" | "ask">("order");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const total = lines.reduce((a, l) => a + (byId.get(l.id)?.priceCents ?? 0) * l.quantity, 0);

  if (msg?.ok) return <div className="w-card w-asked"><b>C&apos;est noté.</b><p>{msg.ok}</p></div>;
  if (options.length === 0) return null;

  return (
    <div className="w-card" style={{ display: "grid", gap: 12 }}>
      <b>Il vous faut autre chose ?</b>
      {hasManager && (
        <div className="w-modes" style={{ justifySelf: "start" }}>
          <button className={tab === "order" ? "on" : ""} onClick={() => setTab("order")}>Commander</button>
          <button className={tab === "ask" ? "on" : ""} onClick={() => setTab("ask")}>Demander à mon manager</button>
        </div>
      )}

      {tab === "order" ? (
        <>
          {lines.map((l) => {
            const cur = byId.get(l.id);
            return (
              <div key={l.key} className="w-reline">
                <select className="w-sel" value={l.id} onChange={(e) => setLines((x) => x.map((y) => (y.key === l.key ? { ...y, id: e.target.value, flavor: null } : y)))}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label} · {eur(o.priceCents)}</option>)}
                </select>
                {(cur?.flavors.length ?? 0) > 0 && (
                  <select className="w-sel" value={l.flavor ?? ""} onChange={(e) => setLines((x) => x.map((y) => (y.key === l.key ? { ...y, flavor: e.target.value || null } : y)))}>
                    <option value="">Goût</option>
                    {cur!.flavors.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
                <input className="w-sel" type="number" min={1} max={20} value={l.quantity} style={{ width: 72 }}
                  onChange={(e) => setLines((x) => x.map((y) => (y.key === l.key ? { ...y, quantity: Number(e.target.value) || 1 } : y)))} />
                <button className="w-ghost" style={{ minHeight: 40, padding: "0 12px" }} onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}>×</button>
              </div>
            );
          })}
          <button className="w-ghost" onClick={() => setLines((x) => [...x, { key: crypto.randomUUID(), id: options[0].id, flavor: null, quantity: 1 }])}>
            + Ajouter
          </button>
          {lines.length > 0 && (
            <>
              <div className="w-line w-total"><span>À régler ce soir</span><b>{eur(total)}</b></div>
              {msg?.error && <span className="w-err" role="alert">{msg.error}</span>}
              <button className="w-accept" disabled={pending} onClick={() => start(async () => {
                setMsg(null);
                const r = await reorder({
                  token,
                  lines: lines.map((l) => {
                    const o = byId.get(l.id)!;
                    return { bottleSizeId: o.kind === "bottle" ? l.id : null, showId: o.kind === "show" ? l.id : null, flavor: l.flavor, quantity: l.quantity };
                  }),
                });
                setMsg(r ?? null);
              })}>{pending ? "Un instant…" : "Envoyer à ma table"}</button>
            </>
          )}
        </>
      ) : (
        <>
          <textarea className="w-input" rows={3} maxLength={600} placeholder="On voudrait un deuxième show pour minuit, qu'est-ce que vous pouvez faire ?"
            value={note} onChange={(e) => setNote(e.target.value)} />
          {msg?.error && <span className="w-err" role="alert">{msg.error}</span>}
          <button className="w-accept" disabled={pending} onClick={() => start(async () => {
            setMsg(null);
            setMsg((await askManager({ token, note })) ?? null);
          })}>{pending ? "Un instant…" : "Demander une proposition"}</button>
        </>
      )}
    </div>
  );
}
