"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTE } from "@/lib/theme";

/* Sélecteur de couleur façon Canva : dégradé, teinte, code hexadécimal, pipette, palette et couleurs récentes. */

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, max ? d / max : 0, max];
}
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

const RECENT = "tablo_recent_colors";
function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(v) ? v.filter((x) => HEX.test(x)).slice(0, 10) : []; } catch { return []; }
}
function pushRecent(c: string) {
  try { localStorage.setItem(RECENT, JSON.stringify([c, ...readRecent().filter((x) => x !== c)].slice(0, 10))); } catch { /* navigation privée */ }
}

type Props = {
  value: string;
  onChange: (hex: string) => void;
  /** Couleurs de l'ambiance en cours, montrées en premier. */
  themeColors?: string[];
  label?: string;
  /** Affiche « Auto » au lieu du code quand la couleur suit l'ambiance. */
  auto?: boolean;
  size?: "sm" | "md";
};

export default function ColorPicker({ value, onChange, themeColors = [], label, auto, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(HEX.test(value) ? value : "#ffffff"));
  const [text, setText] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const sv = useRef<HTMLDivElement>(null);
  const hue = useRef<HTMLDivElement>(null);

  // Une valeur changée de l'extérieur (choix d'une ambiance) remet le sélecteur à jour.
  useEffect(() => {
    if (HEX.test(value) && value.toLowerCase() !== hsvToHex(...hsv)) setHsv(hexToHsv(value));
    setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const emit = (next: [number, number, number]) => { hsvRef.current = next; setHsv(next); const hex = hsvToHex(...next); setText(hex); onChange(hex); };
  const pickHex = (hex: string) => { setHsv(hexToHsv(hex)); setText(hex); onChange(hex); pushRecent(hex); setRecent(readRecent()); };

  const drag = (ref: React.RefObject<HTMLDivElement | null>, apply: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect();
      apply(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height));
    };
    move(e);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); pushRecent(hsvToHex(...hsvRef.current)); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const eyedrop = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) return;
    try { const r = await new ED().open(); if (HEX.test(r.sRGBHex)) pickHex(r.sRGBHex.toLowerCase()); } catch { /* annulé */ }
  };
  const hasEyedropper = typeof window !== "undefined" && "EyeDropper" in window;
  const shown = HEX.test(value) ? value : "#ffffff";
  const uniq = (l: string[]) => [...new Set(l.filter((c) => HEX.test(c)).map((c) => c.toLowerCase()))];

  return (
    <div className={`cp cp-${size}`} ref={root}>
      <button type="button" className="cp-swatch" onClick={() => setOpen((o) => !o)} aria-label={label ? `Couleur : ${label}` : "Choisir une couleur"} aria-expanded={open}>
        <i style={{ background: shown }} />
        <span>{auto ? "Auto" : shown.toUpperCase()}</span>
      </button>
      {open && (
        <div className="cp-pop" role="dialog" aria-label={label || "Couleur"}>
          <div ref={sv} className="cp-sv" style={{ backgroundColor: `hsl(${hsv[0]} 100% 50%)` }}
            onPointerDown={drag(sv, (x, y) => emit([hsvRef.current[0], x, 1 - y]))}>
            <i style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: hsvToHex(...hsv) }} />
          </div>
          <div ref={hue} className="cp-hue" onPointerDown={drag(hue, (x) => emit([x * 359.9, hsvRef.current[1], hsvRef.current[2]]))}>
            <i style={{ left: `${(hsv[0] / 360) * 100}%` }} />
          </div>
          <div className="cp-row">
            <span className="cp-now" style={{ background: hsvToHex(...hsv) }} />
            <input className="cp-hex" value={text} spellCheck={false} maxLength={7} aria-label="Code couleur"
              onChange={(e) => {
                let v = e.target.value.trim();
                if (v && !v.startsWith("#")) v = "#" + v;
                setText(v);
                if (HEX.test(v)) { setHsv(hexToHsv(v)); onChange(v.toLowerCase()); }
              }}
              onBlur={() => HEX.test(text) && pushRecent(text.toLowerCase())} />
            {hasEyedropper && <button type="button" className="cp-drop" onClick={eyedrop} title="Pipette : prendre une couleur à l'écran" aria-label="Pipette">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
            </button>}
          </div>
          {themeColors.length > 0 && <><b className="cp-h">Votre ambiance</b><div className="cp-grid">{uniq(themeColors).map((c) => <button type="button" key={c} style={{ background: c }} onClick={() => pickHex(c)} aria-label={c} title={c.toUpperCase()} />)}</div></>}
          {recent.length > 0 && <><b className="cp-h">Récentes</b><div className="cp-grid">{recent.map((c) => <button type="button" key={c} style={{ background: c }} onClick={() => pickHex(c)} aria-label={c} title={c.toUpperCase()} />)}</div></>}
          <b className="cp-h">Palette</b>
          <div className="cp-grid">{PALETTE.map((c) => <button type="button" key={c} style={{ background: c }} onClick={() => pickHex(c)} aria-label={c} title={c.toUpperCase()} className={c === shown.toLowerCase() ? "on" : ""} />)}</div>
        </div>
      )}
    </div>
  );
}
