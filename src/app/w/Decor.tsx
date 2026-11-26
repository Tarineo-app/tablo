import type { Layer } from "@/lib/theme";

/**
 * Images et textes posés par le club en arrière-plan de la réservation.
 * Positions en % de l'écran (centre de l'élément), tailles en % de la largeur : même rendu dans l'aperçu et dans le widget.
 * Rendu derrière le contenu (z-index négatif dans `.w`, qui isole ses plans).
 */
export function layerStyle(l: Layer): React.CSSProperties {
  const base: React.CSSProperties = {
    left: `${l.x}%`, top: `${l.y}%`, opacity: l.opacity,
    transform: `translate(-50%, -50%) rotate(${l.rot}deg)`,
  };
  return l.kind === "img"
    ? { ...base, width: `${l.size}cqw` }
    : { ...base, fontFamily: `'${l.font || "Manrope"}', system-ui, sans-serif`, color: l.color || "#ffffff", fontSize: `${l.size}cqw` };
}

export default function Decor({ layers, className = "w-deco" }: { layers?: Layer[]; className?: string }) {
  if (!layers?.length) return null;
  return (
    <div className={className} aria-hidden="true">
      {layers.map((l) => l.kind === "img"
        ? l.src ? <img key={l.id} className="w-deco-i" src={l.src} alt="" style={layerStyle(l)} draggable={false} /> : null
        : <span key={l.id} className="w-deco-t" style={layerStyle(l)}>{l.text}</span>)}
    </div>
  );
}
