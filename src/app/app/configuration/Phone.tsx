"use client";

import { useEffect, useState } from "react";
import Plan3D, { type Box } from "@/app/w/[slug]/Plan3D";
import Decor from "@/app/w/Decor";
import Sign from "@/app/w/Sign";
import { samplePlan } from "@/lib/sample-plan";
import { themeVars, type SignConfig, type Theme } from "@/lib/theme";
import type { SetupData } from "./Setup";
import "@/app/w/widget.css";

const eur = (c: number) => `${(c / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const STEPS_W = ["Soirée", "Carré", "Bouteilles", "Shows", "Paiement"];

/** Ce que voit le client, étape par étape : le téléphone à côté de chaque réglage de la configuration. */
export default function Phone({ step, data, theme, sign, focusTable }: { step: string; data: SetupData; theme: Theme; sign?: SignConfig; focusTable?: string | null }) {
  const spot = data.venue.kind === "beach" ? "emplacement" : "carré";
  const boxes: Box[] = data.tables.length ? data.tables : samplePlan(data.venue.kind);
  const [pick, setPick] = useState<string | null>(focusTable ?? boxes[0]?.id ?? null);
  useEffect(() => { if (focusTable) setPick(focusTable); }, [focusTable]);
  const table = data.tablesFull.find((t) => t.id === pick);
  const cat = table ? data.cats.find((c) => c.id === table.categoryId) : null;
  const wStep = { ambiance: 1, carres: 1, bouteilles: 2, shows: 3, pancarte: 3, soiree: 0, paiements: 4, lancement: 4 }[step] ?? 1;
  const bottles = data.bottles.filter((b) => b.active);
  const shows = data.shows.filter((s) => !s.isSign);
  const ev = data.events[0];

  return (
    <div className="ph-wrap">
      <span className="ph-cap">Ce que voit votre client</span>
      <div className="ph">
        <div className="ph-notch" />
        <div className="ph-screen" style={themeVars(theme) as React.CSSProperties}>
          <Decor layers={theme.layers} className="w-deco tp-deco" />
          <div className="ph-top">
            {theme.logoUrl ? <img src={theme.logoUrl} alt="" /> : <b style={{ fontFamily: "var(--w-head)" }}>{data.venue.name}</b>}
            <span>{wStep + 1}/5 · {STEPS_W[wStep]}</span>
          </div>
          {theme.tagline && step === "ambiance" && <p className="w-tagline" style={{ margin: "0 0 6px", fontSize: 11.5 }}>{theme.tagline}</p>}

          {(step === "ambiance" || step === "carres") && (
            <>
              <h3 className="ph-h">Choisissez votre {spot}</h3>
              <Plan3D planImageUrl={data.tables.length ? data.venue.planImageUrl : null} wallColor={data.venue.wallColor} tilt={data.venue.tilt} beach={data.venue.kind === "beach"} selected={pick} onSelect={setPick} boxes={boxes} />
              {step === "carres" && table && (
                <div className="ph-card ph-table">
                  {table.photoUrl ? <img src={table.photoUrl} alt="" /> : <span className="ph-nophoto">Photo du {spot}</span>}
                  <div><b>{table.name}</b><small>{cat?.name} · {table.capacity} pers.</small><small>Minimum {eur(table.minCents ?? Math.round((cat?.minEuros ?? 0) * 100))} · acompte {cat?.depositPct ?? 0} %</small></div>
                </div>
              )}
              {step === "carres" && (
                <div className="ph-cats">{data.cats.filter((c) => c.count > 0 || !data.tables.length).map((c) => <span key={c.id}><i style={{ background: c.color ?? "#a970ff" }} />{c.name} · dès {c.minEuros.toLocaleString("fr-FR")} €</span>)}</div>
              )}
            </>
          )}

          {step === "bouteilles" && (
            <>
              <h3 className="ph-h">Vos bouteilles</h3>
              {bottles.length === 0 && <p className="ph-empty">Vos bouteilles apparaîtront ici, avec leur photo et leur prix.</p>}
              <div className="ph-list">
                {bottles.slice(0, 6).map((b) => (
                  <div key={b.id} className="ph-bottle">
                    <span className="ph-bimg">{b.photoUrl ? <img src={b.photoUrl} alt="" /> : null}</span>
                    <span><b>{b.name}</b><small>{b.sizes[0] ? `${b.sizes[0].label} ${b.sizes[0].volume} · ${eur(b.sizes[0].priceCents)}` : ""}</small></span>
                    <span className="ph-add">+</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "shows" && (
            <>
              <h3 className="ph-h">Pancarte et shows</h3>
              {shows.length === 0 && <p className="ph-empty">Vos shows apparaîtront ici, avec leur photo : c&apos;est ce qui donne envie.</p>}
              <div className="ph-shows">
                {shows.slice(0, 6).map((s) => (
                  <div key={s.id} className="ph-show">
                    <span className="ph-simg">{s.mediaUrl ? <img src={s.mediaUrl} alt="" /> : <i>★</i>}</span>
                    <span><b>{s.name}</b><small>{s.description}</small></span>
                    <em>{s.price ? `+${s.price.toLocaleString("fr-FR")} €` : "Offert"}</em>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "pancarte" && (
            <>
              <h3 className="ph-h">Votre pancarte</h3>
              <p className="ph-empty" style={{ textAlign: "left" }}>Le client écrit son message, il arrive à sa table sur votre pancarte.</p>
              <div style={{ margin: "8px 0 12px" }}><Sign text="HAPPY BDAY SARAH" cfg={sign ?? theme.sign} /></div>
              <div className="ph-input">HAPPY BDAY SARAH</div>
            </>
          )}

          {step === "soiree" && (
            <>
              <h3 className="ph-h">Réservez votre {spot}</h3>
              <div className="ph-events">
                {(data.events.length ? data.events : [{ id: "x", date: new Date(Date.now() + 2 * 864e5).toISOString(), name: "Votre soirée" }]).slice(0, 4).map((e, i) => (
                  <span key={e.id} className={i === 0 ? "on" : ""}><b>{new Date(e.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" })}</b><small>{e.name || "Soirée"}</small></span>
                ))}
              </div>
              <div className="ph-card"><small>Nombre de personnes</small><b>− 6 pers. +</b></div>
            </>
          )}

          {(step === "paiements" || step === "lancement") && (
            <>
              <h3 className="ph-h">{step === "paiements" ? "Vos coordonnées" : "C'est réservé !"}</h3>
              {step === "paiements" ? (
                <div className="ph-card ph-recap">
                  <div><span>{table?.name ?? `Votre ${spot}`}</span><b>{eur(Math.round((cat?.minEuros ?? data.cats[0]?.minEuros ?? 500) * 100))}</b></div>
                  <div><span>Acompte payé maintenant</span><b>{cat?.depositPct ?? data.cats[0]?.depositPct ?? 30} %</b></div>
                  <small>{data.chargesEnabled ? "Paiement sécurisé par carte, Apple Pay ou Google Pay. L'argent arrive sur le compte du club." : "Tant que l'encaissement n'est pas activé, l'acompte se règle sur place."}</small>
                </div>
              ) : (
                <div className="ph-card ph-qr"><div className="qr" aria-hidden="true" /><b>{ev ? new Date(ev.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }) : "Samedi"}</b><small>QR code à présenter à l&apos;entrée, envoyé aussi par email.</small></div>
              )}
            </>
          )}

          <div className="ph-btn">{step === "paiements" ? "Réserver et payer l'acompte" : step === "lancement" ? "Commander une bouteille en plus" : "Continuer"}</div>
          <p className="ph-legal">L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>
        </div>
      </div>
    </div>
  );
}
