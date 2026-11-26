"use client";

import { useState } from "react";
import { FONT_GROUPS, MODES, TEXT_FONTS, type Theme } from "@/lib/theme";

/** Couleurs de l'ambiance en cours, proposées en premier dans le sélecteur. */
export function themeColors(t: Theme): string[] {
  const m = MODES[t.mode] ?? MODES.dark;
  return [t.accent, ...Object.values(t.colors ?? {}), m.bg, m.panel, m.ink, m.mute].filter(Boolean) as string[];
}

/** Arrondi actuel des boutons, en px (30 = pilule). */
export const btnRadiusOf = (t: Theme) => (typeof t.btnRadius === "number" ? t.btnRadius : t.btn === "pill" ? 30 : t.btn === "square" ? 3 : 14);
export const uiRadiusOf = (t: Theme) => (typeof t.uiRadius === "number" ? t.uiRadius : 18);

/** Choix de police : chaque police s'affiche dans son propre style, rangée par famille. */
export function FontPicker({ value, onChange, kind = "head" }: { value: string; onChange: (f: string) => void; kind?: "head" | "text" }) {
  const groups = kind === "head" ? FONT_GROUPS : [{ label: "Texte", fonts: TEXT_FONTS }];
  const start = Math.max(0, groups.findIndex((g) => g.fonts.includes(value)));
  const [tab, setTab] = useState(start);
  const g = groups[tab] ?? groups[0];
  return (
    <div className="fp">
      {groups.length > 1 && (
        <div className="fp-tabs" role="tablist">
          {groups.map((x, i) => <button type="button" role="tab" aria-selected={i === tab} key={x.label} className={i === tab ? "on" : ""} onClick={() => setTab(i)}>{x.label}</button>)}
        </div>
      )}
      <div className="fp-grid">
        {g.fonts.map((f) => (
          <button type="button" key={f} className={`fp-item ${f === value ? "on" : ""}`} onClick={() => onChange(f)} aria-pressed={f === value}>
            <span style={{ fontFamily: `'${f}', system-ui` }}>{kind === "head" ? "Carré VIP" : "Aa Bb 123"}</span>
            <small>{f}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Arrondi : réglette, trois raccourcis et un aperçu de la forme. */
export function RadiusPicker({ value, onChange, max, label, sample }: { value: number; onChange: (v: number) => void; max: number; label: string; sample: "btn" | "card" }) {
  const presets: [string, number][] = sample === "btn" ? [["Carré", 0], ["Arrondi", 14], ["Pilule", 30]] : [["Net", 0], ["Doux", 14], ["Très rond", 28]];
  const r = sample === "btn" && value >= 30 ? 999 : value;
  return (
    <div className="rp">
      <div className="rp-head"><b>{label}</b><span className="mute">{sample === "btn" && value >= 30 ? "Pilule" : `${value} px`}</span></div>
      <div className="rp-row">
        <span className={`rp-sample ${sample}`} style={{ borderRadius: r }} aria-hidden="true">{sample === "btn" ? "Continuer" : ""}</span>
        <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      </div>
      <div className="seg">{presets.map(([l, v]) => <button type="button" key={l} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}</div>
    </div>
  );
}
