"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { serveOrder, takeOrder } from "@/app/actions/service";

export type Envoi = {
  id: string;
  number: number;
  status: "NEW" | "TAKEN" | "SERVED" | "CANCELLED";
  table: string;
  category: string;
  organizer: string;
  guests: number;
  cashDueCents: number;
  takenBy: string | null;
  mine: boolean;
  createdAt: string;
  items: { id: string; label: string; quantity: number }[];
};

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const TABS = [["mine", "Mes carrés"], ["all", "Tous"], ["done", "Servis"]] as const;

export default function Board({ envois, eventName }: { envois: Envoi[]; eventName: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "all" | "done">("all");
  const [pending, start] = useTransition();
  const [now, setNow] = useState(0); // rempli côté navigateur : évite un écart avec l'heure du serveur

  // La soirée bouge vite : on rafraîchit tout seul toutes les 15 secondes.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(() => { tick(); router.refresh(); }, 15000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [router]);

  const open = envois.filter((e) => e.status !== "SERVED" && e.status !== "CANCELLED");
  const list = tab === "done" ? envois.filter((e) => e.status === "SERVED") : tab === "mine" ? open.filter((e) => e.mine) : open;
  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`btn ${tab === k ? "btn-main" : "btn-out"}`} onClick={() => setTab(k)}>
            {label}{k !== "done" && <span style={{ opacity: .7 }}> · {(k === "mine" ? open.filter((e) => e.mine) : open).length}</span>}
          </button>
        ))}
        <span className="mute" style={{ fontSize: 13 }}>{eventName ? `Soirée : ${eventName}` : "Aucune soirée en cours"} · mise à jour automatique</span>
      </div>

      {list.length === 0 && <p className="mute">{tab === "done" ? "Rien de servi pour l'instant." : "Aucun envoi en attente. Bonne soirée."}</p>}

      <div className="envois">
        {list.map((e) => (
          <article key={e.id} className={`card envoi ${e.status === "NEW" ? "neuf" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <b style={{ fontSize: 20, fontFamily: "Unbounded, sans-serif" }}>{e.table}</b>
                <div className="mute" style={{ fontSize: 13 }}>{e.category} · {e.organizer} · {e.guests} pers.</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="tagnum">Envoi n°{e.number}</span>
                <div className="mute" style={{ fontSize: 12, marginTop: 4 }}>{now ? `il y a ${Math.max(0, Math.round((now - new Date(e.createdAt).getTime()) / 60000))} min` : ""}</div>
              </div>
            </div>

            <ul className="items">
              {e.items.map((it) => <li key={it.id}><b>{it.quantity} ×</b> {it.label}</li>)}
            </ul>

            {e.cashDueCents > 0 && <div className="cash">Reste à encaisser sur le carré : <b>{eur(e.cashDueCents)}</b></div>}

            {e.status === "SERVED" ? (
              <span className="okmsg">Servi{e.takenBy ? ` par ${e.takenBy}` : ""}</span>
            ) : e.status === "TAKEN" ? (
              <div className="row" style={{ gap: 8 }}>
                <span className="mute" style={{ fontSize: 13 }}>Pris par {e.takenBy ?? "un serveur"}</span>
                <button className="btn btn-main" disabled={pending} onClick={() => act(() => serveOrder(e.id))}>Servi ✓</button>
              </div>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-main" disabled={pending} onClick={() => act(() => takeOrder(e.id))}>Je prends</button>
                <button className="btn btn-out" disabled={pending} onClick={() => act(() => serveOrder(e.id))}>Servi ✓</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
