"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTheme, type ActionState } from "@/app/actions/club";
import { markSetup, saveSignShow } from "@/app/actions/setup";
import Sign from "@/app/w/Sign";
import ColorPicker from "@/components/ColorPicker";
import { cutout } from "@/lib/cutout";
import { ALL_FONTS, DEFAULT_SIGN, SIGN_STYLES, type SignConfig } from "@/lib/theme";
import type { SetupData } from "./Setup";

/** La pancarte : un modèle Tablo (l'hexagone en exemple), ou la photo de la vraie pancarte du club, avec la zone où s'écrit le message. */
export default function SignStep({ data, cfg, setCfg, onBack, onNext }: { data: SetupData; cfg: SignConfig; setCfg: (c: SignConfig) => void; onBack: () => void; onNext: () => void }) {
  const router = useRouter();
  const sign = data.shows.find((s) => s.isSign);
  const [enabled, setEnabled] = useState(sign ? sign.active : true);
  const [price, setPrice] = useState(String(sign?.price ?? 30));
  const [text, setText] = useState("HAPPY BDAY SARAH");
  const [detour, setDetour] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ActionState>();
  const [pending, start] = useTransition();
  const photoBox = useRef<HTMLDivElement>(null);
  const box = cfg.box ?? DEFAULT_SIGN.box!;
  const set = (p: Partial<SignConfig>) => setCfg({ ...cfg, ...p });

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const r = await cutout(f, { remove: detour, maxSide: 1200, maxChars: 900_000 }); set({ style: "photo", photo: r.url }); }
    catch { setMsg({ error: "Image illisible." }); } finally { setBusy(false); }
  };
  // Glisser la zone du message, ou l'agrandir par son coin.
  const drag = (kind: "move" | "size") => (e: React.PointerEvent) => {
    const el = photoBox.current;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect(), ox = e.clientX, oy = e.clientY, b0 = { ...box };
    const mv = (ev: PointerEvent) => {
      const dx = ((ev.clientX - ox) / r.width) * 100, dy = ((ev.clientY - oy) / r.height) * 100;
      const b = kind === "move"
        ? { ...b0, x: Math.min(100 - b0.w, Math.max(0, b0.x + dx)), y: Math.min(100 - b0.h, Math.max(0, b0.y + dy)) }
        : { ...b0, w: Math.min(100 - b0.x, Math.max(8, b0.w + dx)), h: Math.min(100 - b0.y, Math.max(6, b0.h + dy)) };
      setCfg({ ...cfg, box: b });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const save = () => start(async () => {
    const a = await saveSignShow(enabled, Math.max(0, Number(price.replace(",", ".")) || 0));
    if (a?.error) return setMsg(a);
    const b = await saveTheme({ ...data.theme, sign: cfg });
    if (b?.error) return setMsg(b);
    await markSetup("pancarte");
    router.refresh();
    onNext();
  });

  return (
    <>
      <h1>Votre pancarte</h1>
      <p className="mute">Le client écrit son message en réservant (« HAPPY BDAY SARAH »), et la pancarte arrive à sa table avec les bouteilles. Prenez l&apos;un de nos modèles, ou <strong>mettez en photo votre propre pancarte</strong> : le message du client s&apos;écrira dessus, à l&apos;endroit que vous choisissez.</p>

      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
        <label className="te-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Proposer la pancarte</label>
        {enabled && <label className="field" style={{ maxWidth: 160 }}>Prix<span className="unit"><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />€</span></label>}
      </div>

      {enabled && (
        <>
          <div className="sg-models">
            {SIGN_STYLES.filter((s) => s.key !== "photo").map((s) => (
              <button type="button" key={s.key} className={`sg-model ${cfg.style === s.key ? "on" : ""}`} onClick={() => set({ style: s.key })}>
                <Sign text="HAPPY BDAY" cfg={{ ...cfg, style: s.key }} />
                <span>{s.label}{s.key === "hex" ? " · exemple" : ""}</span>
              </button>
            ))}
            <label className={`sg-model up ${cfg.style === "photo" ? "on" : ""} ${busy ? "is-busy" : ""}`}>
              {cfg.photo ? <Sign text="HAPPY BDAY" cfg={{ ...cfg, style: "photo" }} /> : <span className="sg-upl"><b>+ Votre pancarte</b><small>Une photo de face, bien éclairée</small></span>}
              <span>Votre pancarte (photo)</span>
              <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
          <label className="te-check"><input type="checkbox" checked={detour} onChange={(e) => setDetour(e.target.checked)} /> Retirer le fond de la photo (pancarte posée sur un fond uni)</label>

          {cfg.style === "photo" && cfg.photo && (
            <div className="sg-edit">
              <div className="sg-canvas" ref={photoBox}>
                <img src={cfg.photo} alt="Votre pancarte" draggable={false} />
                <div className="sg-zone" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, fontFamily: `'${cfg.font}'`, color: cfg.color }} onPointerDown={drag("move")}>
                  <span>{text || "VOTRE TEXTE"}</span>
                  <i onPointerDown={drag("size")} aria-label="Agrandir la zone" />
                </div>
              </div>
              <div className="sg-opts">
                <p className="mute" style={{ margin: 0, fontSize: 13 }}>Faites glisser le cadre sur l&apos;endroit où s&apos;écrit le message, et tirez son coin pour l&apos;agrandir.</p>
                <label className="field">Essayer un message<input className="input" maxLength={40} value={text} onChange={(e) => setText(e.target.value.toUpperCase())} /></label>
                <label className="field">Police<select className="select" value={cfg.font} onChange={(e) => set({ font: e.target.value })}>{ALL_FONTS.map((f) => <option key={f}>{f}</option>)}</select></label>
                <div className="field">Couleur du message<ColorPicker value={cfg.color ?? "#121214"} onChange={(c) => set({ color: c })} label="Couleur du message" /></div>
              </div>
            </div>
          )}
        </>
      )}

      {msg?.error && <p className="err">{msg.error}</p>}
      <div className="su-nav">
        <button className="btn btn-out" onClick={onBack}>Retour</button>
        <button className="btn btn-main" disabled={pending || busy} onClick={save}>{pending ? "Enregistrement…" : "Valider la pancarte"}</button>
      </div>
    </>
  );
}
