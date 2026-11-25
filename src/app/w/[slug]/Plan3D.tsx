"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";

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

/** « Lounge 12 » → « L12 », « Carré VIP 3 » → « CV3 », « Impérial » → « Imp ». */
export function shortName(name: string): string {
  const n = name.trim();
  const m = n.match(/^(.*?)[\s-]*(\d+[a-z]?)$/i);
  if (m && m[1]) return m[1].split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") + m[2];
  if (m) return m[2];
  return n.length <= 4 ? n : n.slice(0, 3);
}

type V = CSSProperties & Record<`--${string}`, string | number | undefined>;

const ZMIN = 1, ZMAX = 3.5;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Le plan du club, en relief ou vu de dessus. Chaque emplacement reçoit son mobilier
 * (banquette et table, table haute, cabana, lit balinais) et une étiquette qui reste
 * debout face au client. Pas de bibliothèque 3D : uniquement du CSS 3D, donc léger.
 *
 * Grands plans : on zoome (pincer, Ctrl + molette, boutons) et on se déplace en glissant.
 * Le zoom agrandit vraiment le sol (pas une mise à l'échelle) : les étiquettes gardent leur
 * taille, donc plus on zoome, plus il y a de place. Un carré trop étroit pour son étiquette
 * complète n'affiche qu'une pastille courte (« L12 ») ; l'étiquette complète revient au survol,
 * à la sélection ou en zoomant.
 * Règle : aucun `filter` ni `opacity` sur un élément qui porte du 3D (le navigateur l'aplatit).
 */
export default function Plan3D({ boxes, planImageUrl, wallColor, tilt, selected, onSelect, label, beach, startFlat }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [rot, setRot] = useState(0);
  const [flat, setFlat] = useState(!!startFlat);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);

  // Gestes : un doigt (ou la souris) déplace, deux doigts zooment.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number; moved: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = view.w > 0 && view.w < 460;
  const mx = narrow ? 0.04 : 0.09; // marge sur les côtés au zoom 1
  // Le sol garde toujours la même forme (celle de l'éditeur de plan), quel que soit l'écran.
  // L'inclinaison s'anime en JS (et pas en CSS) pour que les étiquettes suivent exactement la scène.
  const target = flat ? 0 : tilt;
  const [t, setT] = useState(target);
  const tRef = useRef(target);
  useEffect(() => {
    const from = tRef.current, start = performance.now();
    if (from === target) return;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 450), e = 1 - Math.pow(1 - k, 3);
      tRef.current = from + (target - from) * e;
      setT(tRef.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const squash = Math.cos((t * Math.PI) / 180); // la 3D écrase la profondeur
  // En 3D le sol paraît moins haut (écrasé par l'inclinaison) : il peut donc être plus large.
  const baseW = Math.min(view.w * (1 - 2 * mx), (view.h * 0.7) / (0.62 * Math.max(squash, 0.55))), baseH = baseW * 0.62;
  const W = baseW * zoom, H = baseH * zoom;

  // Position du sol dans le cadre.
  const L = (view.w - W) / 2 + pan.x;
  const T = (view.h - H) / 2 + view.h * (flat ? 0 : 0.05) + pan.y;
  const PER = 1400; // = perspective de .p3-view
  const tr = (t * Math.PI) / 180, rr = (rot * Math.PI) / 180;
  /** Où tombe à l'écran un point du sol (px, py) situé à la hauteur pz : même calcul que le navigateur
   *  (rotateX(t) rotateZ(rot) autour du centre du sol, puis perspective depuis 50 % 40 % du cadre). */
  function project(px: number, py: number, pz: number) {
    const x = px - W / 2, y = py - H / 2;
    const x1 = x * Math.cos(rr) - y * Math.sin(rr), y1 = x * Math.sin(rr) + y * Math.cos(rr);
    const y2 = y1 * Math.cos(tr) - pz * Math.sin(tr), z2 = y1 * Math.sin(tr) + pz * Math.cos(tr);
    const ox = view.w * 0.5, oy = view.h * 0.4, k = PER / (PER - z2);
    return { x: ox + (L + W / 2 + x1 - ox) * k, y: oy + (T + H / 2 + y2 - oy) * k };
  }

  // On ne laisse pas le plan partir hors du cadre.
  function bound(p: { x: number; y: number }, z = zoom) {
    const lx = Math.max(0, (baseW * z - baseW) / 2 + view.w * 0.05);
    const ly = Math.max(0, ((baseH * z - baseH) / 2) * squash + view.h * 0.08);
    return { x: clamp(p.x, -lx, lx), y: clamp(p.y, -ly, ly) };
  }

  function setZoomTo(z: number) {
    const nz = clamp(z, ZMIN, ZMAX);
    setZoom(nz);
    setPan((p) => (nz === 1 ? { x: 0, y: 0 } : bound({ x: (p.x * nz) / zoom, y: (p.y * nz) / zoom }, nz)));
  }

  // Molette : seulement avec Ctrl (pincement du pavé tactile), sinon la page défile normalement.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomTo(zoom * Math.exp(-e.deltaY * 0.01));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function spread() {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  function onDown(e: RPointerEvent<HTMLDivElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragged.current = false;
    gesture.current = { dist: spread(), zoom, moved: 0 };
  }
  function onMove(e: RPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const d = spread();
      if (gesture.current.dist > 0 && d > 0) setZoomTo((gesture.current.zoom * d) / gesture.current.dist);
      dragged.current = true;
      return;
    }
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 6) dragged.current = true;
    if (zoom > 1 && dragged.current) setPan((p) => bound({ x: p.x + dx, y: p.y + dy }));
  }
  function onUp(e: RPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    gesture.current = pointers.current.size ? { dist: spread(), zoom, moved: 99 } : null;
  }

  function pick(b: Box, keyboard = false) {
    if (dragged.current && !keyboard) return; // c'était un glissé, pas un choix
    onSelect(b.id);
    if (zoom > 1) {
      // On amène le carré choisi au centre.
      const cx = ((b.x + b.w / 2) / 100) * W, cy = ((b.y + b.h / 2) / 100) * H;
      setPan(bound({ x: W / 2 - cx, y: (H / 2 - cy) * squash }));
    }
  }

  const unit = W / 100; // 1 % de largeur du sol, en pixels
  const fullMin = narrow ? 56 : 70; // largeur sous laquelle un carré n'affiche que sa pastille
  const geo = boxes.map((b) => {
    const kind = b.kind ?? "carre";
    const left = (b.x / 100) * W, top = (b.y / 100) * H;
    const bw = (b.w / 100) * W, bh = (b.h / 100) * H;
    const m = Math.min(bw, bh);
    const off = b.taken || b.small;
    const z = kind === "bali" || kind === "haute" ? 2 : Math.max(3, Math.min(m * 0.5, b.elevation * unit * 1.6));
    const roof = Math.round(Math.max(14, Math.min(40, m * 0.62))); // hauteur de la toile
    const tab = Math.round(Math.max(8, Math.min(20, m * 0.36))); // hauteur d'une table haute
    const isSel = selected === b.id;
    const compact = !isSel && bw < fullMin;
    const state = b.taken ? "pris" : b.small ? "petit" : isSel ? "on" : "libre";
    return { b, kind, left, top, bw, bh, m, off, z, roof, tab, compact, state };
  });
  const many = boxes.length > 12;

  return (
    <div className="p3">
      <div
        className={`p3-view ${beach ? "beach" : ""} ${zoom > 1 ? "zoomed" : ""}`}
        ref={wrap}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <div className={`p3-stage ${flat ? "flat" : ""} ${narrow ? "narrow" : ""}`}
          style={{
            width: W, height: H,
            left: L, top: T,
            transform: `rotateX(${t}deg) rotateZ(${rot}deg)`,
          }}>
          <div className={`p3-floor ${planImageUrl ? "img" : beach ? "sand" : "club"}`}
            style={planImageUrl ? { backgroundImage: `url(${planImageUrl})` } : wallColor && !beach ? { backgroundColor: wallColor } : undefined} />
          {view.w > 0 && geo.map(({ b, kind, left, top, bw, bh, z, roof, tab, m, off, state, compact }) => {
            const style: V = {
              left, top, width: bw, height: bh,
              "--col": b.color ?? undefined, "--z": `${z}px`, "--roof": `${roof}px`, "--tabh": `${tab}px`,
              "--sw": `${Math.max(2, Math.round(m * 0.13))}px`,
            };
            const showWalls = kind === "carre" || kind === "cabana";
            return (
              <div key={b.id} className={`p3-box k-${kind} ${state} ${compact ? "compact" : ""}`} style={style}>
                {showWalls && <>
                  <span className="f side" style={{ width: bw, height: z, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                  <span className="f side" style={{ width: bw, height: z, top: bh, transform: `translateZ(${z}px) rotateX(-90deg)` }} />
                  <span className="f side dark" style={{ width: bh, height: z, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                  <span className="f side dark" style={{ width: bh, height: z, left: bw, transform: `translateZ(${z}px) rotateX(-90deg) rotateY(-90deg)` }} />
                </>}
                <button className="f top" style={{ transform: `translateZ(${z}px)` }}
                  onClick={(e) => !off && pick(b, e.detail === 0)} disabled={off}
                  onPointerEnter={() => setHover(b.id)} onPointerLeave={() => setHover((h) => (h === b.id ? null : h))}
                  aria-label={`${b.name} · ${label ? label(b) : b.sub}`}>
                  {kind === "carre" && <><i className="p3-sofa" /><i className="p3-tab" /></>}
                  {kind === "haute" && <i className="p3-tab" />}
                  {kind === "cabana" && <><i className="p3-bed" /><i className="p3-post a" /><i className="p3-post b" /><i className="p3-post c" /><i className="p3-post d" /><i className="p3-roof" /></>}
                  {kind === "bali" && <><i className="p3-bed" /><i className="p3-post" /><i className="p3-roof" /></>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Les étiquettes vivent hors de la scène 3D : on calcule leur place à l'écran,
            donc le mobilier ne peut jamais les cacher. Les plus proches passent devant. */}
        <div className={`p3-labels ${flat ? "flat" : ""} ${narrow ? "narrow" : ""}`} aria-hidden="true">
          {view.w > 0 && [...geo].sort((a, c) => a.top + a.bh - (c.top + c.bh)).map(({ b, kind, left, top, bw, bh, z, roof, tab, off, state, compact }) => {
            const lift = flat ? 0 : kind === "cabana" || kind === "bali" ? roof + 8 : kind === "haute" ? tab + (compact ? 6 : 10) : compact ? 6 : 12;
            const p = project(left + bw / 2, top + bh / 2, z + lift);
            const full = !compact || hover === b.id;
            return (
              <span key={b.id} className={`p3-pin ${state} ${full ? "" : "compact"} ${hover === b.id ? "hov" : ""}`}
                style={{ left: p.x, top: p.y, zIndex: b.id === selected || hover === b.id ? 50 : undefined, "--col": b.color ?? undefined } as V}
                onClick={() => !off && pick(b)}>
                {full ? <span className="full">{b.name}{!off && <small>{label ? label(b) : b.sub}</small>}</span> : <span className="code">{shortName(b.name)}</span>}
                {b.id === selected && b.photoUrl && <span className="p3-card"><img src={b.photoUrl} alt="" /></span>}
              </span>
            );
          })}
        </div>

        <div className="p3-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setZoomTo(zoom * 1.5)} disabled={zoom >= ZMAX} aria-label="Zoomer">+</button>
          <button type="button" onClick={() => setZoomTo(zoom / 1.5)} disabled={zoom <= ZMIN} aria-label="Dézoomer">−</button>
          {zoom > 1 && <button type="button" onClick={() => setZoomTo(1)} aria-label="Voir tout le plan">⤢</button>}
        </div>
        <div className="p3-ctrl" onPointerDown={(e) => e.stopPropagation()}>
          <div className="p3-seg">
            <button className={flat ? "" : "on"} onClick={() => setFlat(false)} aria-label="Vue 3D">3D</button>
            <button className={flat ? "on" : ""} onClick={() => setFlat(true)} aria-label="Vue de dessus">Plan</button>
          </div>
          {!flat && (
            <label className="p3-rot"><span>Tourner</span>
              <input type="range" min={-50} max={50} value={rot} onChange={(e) => setRot(Number(e.target.value))} aria-label="Tourner le plan" />
            </label>
          )}
        </div>
        {zoom === 1 && many && <span className="p3-hint">Pincez ou touchez + pour zoomer</span>}
      </div>

    </div>
  );
}
