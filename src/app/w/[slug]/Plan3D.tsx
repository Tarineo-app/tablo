"use client";

import { useEffect, useRef, useState } from "react";

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
};

type Props = {
  boxes: Box[];
  planImageUrl: string | null;
  wallColor: string | null;
  tilt: number;
  selected: string | null;
  onSelect: (id: string) => void;
  label?: (b: Box) => string;
};

/**
 * Vue 3D du plan, construite à partir du plan 2D du club : chaque carré est
 * extrudé à la hauteur de sa catégorie. Aucun modèle 3D à fournir, et pas de
 * bibliothèque : tout est fait en CSS 3D, donc léger dans le widget.
 */
export default function Plan3D({ boxes, planImageUrl, wallColor, tilt, selected, onSelect, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [rot, setRot] = useState(0);
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unit = size.w / 100; // 1 % de largeur, en pixels
  const t = flat ? 0 : tilt;

  return (
    <div className="p3">
      <div className="p3-view" ref={wrap}>
        <div className="p3-stage" style={{ transform: `rotateX(${t}deg) rotateZ(${rot}deg)` }}>
          <div className="p3-floor" style={{ backgroundImage: planImageUrl ? `url(${planImageUrl})` : undefined, background: planImageUrl ? undefined : wallColor ?? undefined }} />
          {size.w > 0 && boxes.map((b) => {
            const left = (b.x / 100) * size.w, top = (b.y / 100) * size.h;
            const bw = (b.w / 100) * size.w, bh = (b.h / 100) * size.h;
            const z = Math.max(2, b.elevation * unit * 1.6);
            const state = b.taken ? "pris" : b.small ? "petit" : selected === b.id ? "on" : "libre";
            const col = b.color ?? undefined;
            return (
              <div key={b.id} className={`p3-box ${state}`} style={{ left, top, width: bw, height: bh, ["--col" as string]: col }}>
                <span className="f side" style={{ width: bw, height: z, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                <span className="f side" style={{ width: bw, height: z, top: bh, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                <span className="f side dark" style={{ width: bh, height: z, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                <span className="f side dark" style={{ width: bh, height: z, left: bw, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                <button className="f top" style={{ transform: `translateZ(${z}px)` }}
                  onClick={() => !b.taken && !b.small && onSelect(b.id)} disabled={b.taken || b.small}
                  aria-label={`${b.name} · ${b.sub}`}>
                  <b style={{ transform: `rotateZ(${-rot}deg)` }}>{b.name}<small>{label ? label(b) : b.sub}</small></b>
                </button>
                {selected === b.id && b.photoUrl && (
                  <span className="p3-card" style={{ transform: `translateZ(${z}px) rotateZ(${-rot}deg) rotateX(${-t}deg) translateY(-62px)` }}>
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
