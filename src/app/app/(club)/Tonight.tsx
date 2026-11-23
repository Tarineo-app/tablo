"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkIn, createWalkIn, markNoShow, type FloorState } from "@/app/actions/floor";
import { useActionState } from "react";

export type FloorTable = {
  id: string; name: string; category: string; capacity: number; minSpendCents: number;
  x: number; y: number; w: number; h: number;
  resa: null | { id: string; name: string; phone: string; guests: number; totalCents: number; paidCents: number; status: string; manager: string | null; orders: number };
};

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const STATUS: Record<string, string> = { DRAFT: "À payer", PENDING_PAYMENT: "Paiement en cours", CONFIRMED: "Confirmé", FULLY_PAID: "Payé", CHECKED_IN: "Arrivé", COMPLETED: "Terminé", NO_SHOW: "Absent" };

export default function Tonight({ tables, eventId, planImageUrl }: { tables: FloorTable[]; eventId: string; planImageUrl: string | null }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [router]);

  const table = tables.find((t) => t.id === openId) ?? null;
  const act = (fn: () => Promise<{ error?: string; ok?: string }>) =>
    start(async () => { const r = await fn(); setMsg(r.error ?? r.ok); router.refresh(); });

  return (
    <div className="floorwrap2">
      <div className="floorplan" style={planImageUrl ? { backgroundImage: `url(${planImageUrl})` } : undefined}>
        {tables.map((t) => {
          const state = !t.resa ? "libre" : t.resa.status === "CHECKED_IN" ? "arrive" : t.resa.status === "NO_SHOW" ? "absent" : "reserve";
          return (
            <button key={t.id} className={`ft ${state} ${openId === t.id ? "on" : ""}`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}
              onClick={() => { setOpenId(openId === t.id ? null : t.id); setMsg(undefined); }}>
              <span>{t.name}<small>{t.resa ? `${t.resa.name.split(" ")[0]} · ${t.resa.guests}p` : `libre · ${t.capacity}p`}</small></span>
            </button>
          );
        })}
      </div>

      <aside className="floorside">
        {!table && (
          <>
            <h2 style={{ fontSize: 17, margin: 0 }}>Plan de la soirée</h2>
            <p className="mute" style={{ fontSize: 14 }}>Touchez un carré pour voir qui y est, marquer l&apos;arrivée, ou installer un client venu sans réservation.</p>
            <div className="legend2">
              <span><i className="libre" />Libre</span><span><i className="reserve" />Réservé</span><span><i className="arrive" />Arrivé</span><span><i className="absent" />Absent</span>
            </div>
            <ul className="tonightlist">
              {tables.filter((t) => t.resa).map((t) => (
                <li key={t.id}>
                  <button onClick={() => setOpenId(t.id)}>
                    <b>{t.name}</b>
                    <span>{t.resa!.name} · {t.resa!.guests}p · {eur(t.resa!.totalCents)}</span>
                    <span className={`pastille ${t.resa!.status === "CHECKED_IN" ? "ok" : ""}`}>{STATUS[t.resa!.status] ?? t.resa!.status}</span>
                  </button>
                </li>
              ))}
              {tables.every((t) => !t.resa) && <li className="mute" style={{ padding: 8 }}>Aucune réservation pour ce soir.</li>}
            </ul>
          </>
        )}

        {table && (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>{table.name}</h2>
              <button className="btn btn-out" onClick={() => setOpenId(null)}>Fermer</button>
            </div>
            <p className="mute" style={{ fontSize: 13, margin: 0 }}>{table.category} · {table.capacity} personnes · minimum {eur(table.minSpendCents)}</p>

            {table.resa ? (
              <>
                <div className="card" style={{ display: "grid", gap: 6 }}>
                  <b style={{ fontSize: 17 }}>{table.resa.name}</b>
                  <span className="mute" style={{ fontSize: 13 }}>{table.resa.phone || "pas de téléphone"} · {table.resa.guests} personnes</span>
                  {table.resa.manager && <span className="tag soft">via {table.resa.manager}</span>}
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="mute">Total</span><b>{eur(table.resa.totalCents)}</b></div>
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="mute">Déjà payé</span><b>{eur(table.resa.paidCents)}</b></div>
                  <div className="row" style={{ justifyContent: "space-between" }}><span className="mute">Envois</span><b>{table.resa.orders}</b></div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-main" disabled={pending} onClick={() => act(() => checkIn(table.resa!.id))}>
                    {table.resa.status === "CHECKED_IN" ? "Annuler l'arrivée" : "Marquer arrivé"}
                  </button>
                  <button className="btn btn-out" disabled={pending} onClick={() => act(() => markNoShow(table.resa!.id))}>
                    {table.resa.status === "NO_SHOW" ? "Annuler l'absence" : "Absent"}
                  </button>
                </div>
              </>
            ) : (
              <WalkInForm eventId={eventId} tableId={table.id} onDone={() => { setOpenId(null); router.refresh(); }} />
            )}
            {msg && <p className="okmsg" style={{ margin: 0 }}>{msg}</p>}
          </>
        )}
      </aside>
    </div>
  );
}

function WalkInForm({ eventId, tableId, onDone }: { eventId: string; tableId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(createWalkIn, undefined as FloorState);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="tableId" value={tableId} />
      <h3 style={{ fontSize: 15, margin: 0 }}>Client sans réservation</h3>
      <label className="field">Nom<input className="input" name="name" required placeholder="Ex. Groupe Mehdi" /></label>
      <div className="grid2">
        <label className="field">Personnes<input className="input" name="guests" inputMode="numeric" defaultValue={6} required /></label>
        <label className="field">Téléphone<input className="input" name="phone" inputMode="tel" /></label>
      </div>
      <label className="field">Montant annoncé (€, facultatif)<input className="input" name="amount" inputMode="decimal" placeholder="1500" /></label>
      <div className="row">
        <button className="btn btn-main" disabled={pending}>{pending ? "…" : "Installer à ce carré"}</button>
        {state?.error && <span className="err">{state.error}</span>}
      </div>
    </form>
  );
}
