"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Le mobilier dessiné sur l'emplacement, déduit du nom de la catégorie ou du carré. */
export type Kind = "carre" | "haute" | "cabana" | "bali";

export type Box = {
  id: string;
  name: string;
  sub: string;
  x: number; y: number; w: number; h: number; // en % du plan
  elevation: number; // hauteur de l'estrade, en unités
  color: string | null;
  photoUrl: string | null;
  taken: boolean;
  small: boolean; // trop petit pour le groupe
  kind?: Kind;
};

type Props = {
  boxes: Box[];
  planImageUrl: string | null;
  wallColor: string | null;
  tilt: number;
  selected: string | null;
  onSelect: (id: string) => void;
  label?: (b: Box) => string;
  beach?: boolean;
  startFlat?: boolean;
};

export function kindOf(...names: (string | null | undefined)[]): Kind {
  const s = names.filter(Boolean).join(" ").toLowerCase();
  if (/caban|tente|pergola|paillote/.test(s)) return "cabana";
  if (/bali|daybed|\blit\b|transat|parasol|matelas/.test(s)) return "bali";
  if (/haute|mange|debout|high/.test(s)) return "haute";
  return "carre";
}

type V = CSSProperties & Record<`--${string}`, string | number | undefined>;

/**
 * Le plan du club, en relief ou vu de dessus. Chaque emplacement reçoit son mobilier
 * (banquette et table, table haute, cabana, lit balinais) et une étiquette qui reste
 * debout face au client. Pas de bibliothèque 3D : uniquement du CSS 3D, donc léger.
 * Règle : aucun `filter` ni `opacity` sur un élément qui porte du 3D (le navigateur l'aplatit).
 */
export default function Plan3D({ boxes, planImageUrl, wallColor, tilt, selected, onSelect, label, beach, startFlat }: Props) {
  const wrap = useRef<HTMLDivElement>(null); // le cadre
  const stage = useRef<HTMLDivElement>(null); // le sol : les positions sont en % de lui
  const [size, setSize] = useState({ w: 0, h: 0, view: 0 });
  const [rot, setRot] = useState(0);
  const [flat, setFlat] = useState(!!startFlat);

  useEffect(() => {
    const view = wrap.current, el = stage.current;
    if (!view || !el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight, view: view.clientWidth }));
    ro.observe(view);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unit = size.w / 100; // 1 % de largeur, en pixels
  const t = flat ? 0 : tilt;
  const narrow = size.view > 0 && size.view < 460;

  return (
    <div className="p3">
      <div className={`p3-view ${beach ? "beach" : ""}`} ref={wrap}>
        <div ref={stage} className={`p3-stage ${flat ? "flat" : ""} ${narrow ? "narrow" : ""}`} style={{ transform: `rotateX(${t}deg) rotateZ(${rot}deg)` }}>
          <div className={`p3-floor ${planImageUrl ? "img" : beach ? "sand" : "club"}`}
            style={planImageUrl ? { backgroundImage: `url(${planImageUrl})` } : wallColor && !beach ? { backgroundColor: wallColor } : undefined} />
          {size.w > 0 && boxes.map((b) => {
            const kind = b.kind ?? "carre";
            const left = (b.x / 100) * size.w, top = (b.y / 100) * size.h;
            const bw = (b.w / 100) * size.w, bh = (b.h / 100) * size.h;
            const m = Math.min(bw, bh);
            const off = b.taken || b.small;
            const z = kind === "bali" || kind === "haute" ? 2 : Math.max(3, b.elevation * unit * 1.6);
            const roof = Math.round(Math.max(16, Math.min(40, m * 0.62))); // hauteur de la toile
            const tab = Math.round(Math.max(8, Math.min(20, m * 0.36))); // hauteur d'une table haute
            // Hauteur de l'étiquette. Vue de dessus, on la monte nettement au-dessus du mobilier :
            // deux plans trop proches se chevauchent mal dans le navigateur.
            const pz = (kind === "cabana" || kind === "bali" ? roof + 8 : kind === "haute" ? tab + 8 : narrow ? 10 : 14) + (flat ? 18 : 0);
            const state = b.taken ? "pris" : b.small ? "petit" : selected === b.id ? "on" : "libre";
            const style: V = {
              left, top, width: bw, height: bh,
              "--col": b.color ?? undefined, "--z": `${z}px`, "--roof": `${roof}px`, "--tabh": `${tab}px`,
              "--sw": `${Math.max(3, Math.round(m * 0.13))}px`,
            };
            const showWalls = kind === "carre" || kind === "cabana";
            return (
              <div key={b.id} className={`p3-box k-${kind} ${state}`} style={style}>
                {showWalls && <>
                  <span className="f side" style={{ width: bw, height: z, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                  <span className="f side" style={{ width: bw, height: z, top: bh, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                  <span className="f side dark" style={{ width: bh, height: z, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                  <span className="f side dark" style={{ width: bh, height: z, left: bw, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                </>}
                <button className="f top" style={{ transform: `translateZ(${z}px)` }}
                  onClick={() => !off && onSelect(b.id)} disabled={off}
                  aria-label={`${b.name} · ${label ? label(b) : b.sub}`}>
                  {kind === "carre" && <><i className="p3-sofa" /><i className="p3-tab" /></>}
                  {kind === "haute" && <i className="p3-tab" />}
                  {kind === "cabana" && <><i className="p3-bed" /><i className="p3-post a" /><i className="p3-post b" /><i className="p3-post c" /><i className="p3-post d" /><i className="p3-roof" /></>}
                  {kind === "bali" && <><i className="p3-bed" /><i className="p3-post" /><i className="p3-roof" /></>}
                  <span className="p3-pin" style={{ transform: `translateZ(${pz}px) rotateZ(${-rot}deg) rotateX(${-t}deg)` }}>
                    <span>{b.name}{!off && <small>{label ? label(b) : b.sub}</small>}</span>
                  </span>
                </button>
                {selected === b.id && b.photoUrl && (
                  <span className="p3-card" style={{ transform: `translateZ(${pz + 30}px) rotateZ(${-rot}deg) rotateX(${-t}deg) translateY(-62px)` }}>
                    <img src={b.photoUrl} alt={b.name} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p3-ctrl">
        <div className="p3-seg">
          <button className={flat ? "" : "on"} onClick={() => setFlat(false)}>Vue 3D</button>
          <button className={flat ? "on" : ""} onClick={() => setFlat(true)}>Vue de dessus</button>
        </div>
        {!flat && (
          <label className="p3-rot">Tourner
            <input type="range" min={-50} max={50} value={rot} onChange={(e) => setRot(Number(e.target.value))} aria-label="Tourner le plan" />
          </label>
        )}
      </div>
    </div>
  );
}
