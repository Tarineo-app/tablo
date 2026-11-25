"use client";

import { useState, useTransition } from "react";
import { saveTheme } from "@/app/actions/club";
import { AMBIANCES, GRADIENTS, HEAD_FONTS, MODES, TEXT_FONTS, themeVars, type Theme } from "@/lib/theme";
import Plan3D, { type Box } from "@/app/w/[slug]/Plan3D";
import "@/app/w/widget.css";

/** Un petit plan d'exemple pour l'aperçu : il prend les couleurs et les polices choisies. */
const SAMPLE = (kind: string): Box[] => {
  const b = (id: string, name: string, x: number, y: number, w: number, h: number, color: string, k: Box["kind"], sub: string, taken = false): Box =>
    ({ id, name, sub, x, y, w, h, elevation: 2, color, photoUrl: null, taken, small: false, kind: k });
  return kind === "beach"
    ? [b("a", "Cabana 1", 6, 10, 20, 26, "#4fd8ff", "cabana", "min 600 €"), b("b", "Bali 1", 40, 14, 16, 22, "#ff8a5f", "bali", "min 400 €"), b("c", "Cabana 2", 72, 10, 20, 26, "#4fd8ff", "cabana", "", true), b("d", "Ponton", 34, 60, 32, 24, "#ffd25f", "carre", "min 1 200 €")]
    : [b("a", "Impérial", 6, 8, 24, 22, "#ffd25f", "carre", "min 1 500 €"), b("b", "Scène", 40, 8, 20, 22, "#ff5fa2", "carre", "", true), b("c", "Lounge 1", 70, 8, 22, 22, "#a970ff", "carre", "min 500 €"), b("d", "Haute 1", 22, 62, 12, 20, "#4fd8ff", "haute", "min 200 €"), b("e", "Lounge 2", 62, 58, 24, 24, "#a970ff", "carre", "min 500 €")];
};

export default function ThemeEditor({ initial, venueName, kind = "club" }: { initial: Theme; venueName: string; kind?: string }) {
  const [pick, setPick] = useState<string | null>("c");
  const [t, setT] = useState<Theme>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const set = (patch: Partial<Theme>) => { setT((x) => ({ ...x, ...patch, amb: "amb" in patch ? (patch.amb as string) : "perso" })); setMsg(undefined); };

  const onLogo = (f?: File) => {
    if (!f) return;
    if (f.size > 400_000) { setMsg({ error: "Logo trop lourd : 400 Ko maximum (PNG ou SVG conseillé)." }); return; }
    const r = new FileReader();
    r.onload = () => set({ logoUrl: String(r.result) });
    r.readAsDataURL(f);
  };

  return (
    <div className="grid2" style={{ alignItems: "start", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)" }}>
      <div style={{ display: "grid", gap: 16 }}>
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 16 }}>Ambiance de départ</h2>
          <div className="ambs">
            {Object.values(AMBIANCES).map((a) => (
              <button type="button" key={a.amb} className={`amb ${t.amb === a.amb ? "on" : ""}`}
                onClick={() => set({ amb: a.amb, accent: a.accent, grad: a.grad, mode: a.mode, font: a.font, head: a.head, btn: a.btn })}>
                <span className="sw" style={{ background: a.swatch }}><em style={{ fontFamily: `'${a.head}'`, color: a.accent === "#16141a" ? "#16141a" : a.amb === "pool" ? "#fff" : a.accent }}>Aa</em></span>
                {a.name}<small>{a.desc}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="card" style={{ display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 16 }}>Marque</h2>
          <label className="field">Logo (PNG transparent ou SVG, 400 Ko max)
            <input className="input" type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
          {t.logoUrl && <button type="button" className="btn btn-danger" style={{ justifySelf: "start" }} onClick={() => set({ logoUrl: null })}>Retirer le logo</button>}
          <label className="field">Couleur principale
            <div className="row"><input type="color" value={t.accent} onChange={(e) => set({ accent: e.target.value })} style={{ width: 54, height: 44, border: 0, background: "none" }} />
              <input className="input" style={{ maxWidth: 140 }} value={t.accent} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set({ accent: e.target.value })} /></div>
          </label>
          <label className="field">Texte du bouton sur votre site<input className="input" maxLength={28} value={t.fab} onChange={(e) => set({ fab: e.target.value })} /></label>
        </section>

        <section className="card" style={{ display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 16 }}>Style</h2>
          <div className="field">Fond du widget
            <div className="seg">{Object.entries(MODES).map(([k, m]) => <button type="button" key={k} className={t.mode === k ? "on" : ""} onClick={() => set({ mode: k as Theme["mode"] })}>{m.label}</button>)}</div>
          </div>
          <div className="field">Boutons
            <div className="seg">
              <button type="button" className={t.grad === "" ? "on" : ""} onClick={() => set({ grad: "" })}>Couleur unie</button>
              {Object.entries(GRADIENTS).map(([k, g]) => <button type="button" key={k} className={t.grad === k ? "on" : ""} onClick={() => set({ grad: k as Theme["grad"] })}>{g.label}</button>)}
            </div>
            <div className="seg" style={{ marginTop: 8 }}>
              {([["round", "Arrondis"], ["pill", "Pilule"], ["square", "Carrés"]] as const).map(([k, l]) => <button type="button" key={k} className={t.btn === k ? "on" : ""} onClick={() => set({ btn: k })}>{l}</button>)}
            </div>
          </div>
          <div className="grid2">
            <label className="field">Police des titres<select className="select" value={t.head} onChange={(e) => set({ head: e.target.value })}>{HEAD_FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label className="field">Police des textes<select className="select" value={t.font} onChange={(e) => set({ font: e.target.value })}>{TEXT_FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
          </div>
        </section>

        <div className="row">
          <button className="btn btn-main" disabled={pending} onClick={() => start(async () => setMsg(await saveTheme(t)))}>{pending ? "Enregistrement…" : "Enregistrer l'ambiance"}</button>
          {msg?.error && <span className="err">{msg.error}</span>}
          {msg?.ok && <span className="okmsg">{msg.ok}</span>}
        </div>
      </div>

      <aside style={{ position: "sticky", top: 24 }}>
        <div className="mute" style={{ fontSize: 13, marginBottom: 8 }}>Aperçu du widget</div>
        <div style={{ ...(themeVars(t) as React.CSSProperties), background: "var(--w-bg)", color: "var(--w-ink)", fontFamily: "var(--w-font)", borderRadius: 24, padding: 18, border: "1px solid var(--w-line)", display: "grid", gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            {t.logoUrl ? <img src={t.logoUrl} alt={venueName} style={{ height: 30, maxWidth: 160, objectFit: "contain" }} /> : <b style={{ fontFamily: "var(--w-head)", fontSize: 18 }}>{venueName}</b>}
            <span style={{ color: "var(--w-mute)", fontSize: 13 }}>✕</span>
          </div>
          <div style={{ fontFamily: "var(--w-head)", fontSize: 24, lineHeight: 1.1, color: "var(--w-accent)" }}>Choisissez votre carré</div>
          <div style={{ background: "var(--w-panel)", border: "1px solid var(--w-line)", borderRadius: 16, padding: 14, display: "grid", gap: 8, fontSize: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span>Carré Prestige · 8 pers.</span><b>dès 1 500 €</b></div>
            <div className="row" style={{ justifyContent: "space-between", color: "var(--w-mute)" }}><span>Acompte</span><span>50 %</span></div>
          </div>
          <Plan3D planImageUrl={null} wallColor={null} tilt={50} beach={kind === "beach"} selected={pick} onSelect={setPick} boxes={SAMPLE(kind)} />
          <div style={{ height: 50, borderRadius: "var(--w-radius)", background: "var(--w-btn)", color: "var(--w-on)", display: "grid", placeItems: "center", fontWeight: 800 }}>Continuer</div>
          <div style={{ justifySelf: "end", marginTop: 6, padding: "12px 18px", borderRadius: "var(--w-radius)", background: "var(--w-btn)", color: "var(--w-on)", fontWeight: 800, fontSize: 14 }}>{t.fab || "Réserver"}</div>
        </div>
      </aside>
    </div>
  );
}
