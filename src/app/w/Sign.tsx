import { DEFAULT_SIGN, type SignConfig } from "@/lib/theme";

/** La pancarte telle que le client la recevra : modèle Tablo, ou photo de la vraie pancarte du club avec son message dessus. */
export default function Sign({ text, cfg, placeholder = "VOTRE TEXTE ICI" }: { text: string; cfg?: SignConfig | null; placeholder?: string }) {
  const c = cfg ?? DEFAULT_SIGN;
  const t = (text || placeholder).toUpperCase();
  const size = Math.max(0.6, Math.min(1.25, 14 / Math.max(6, t.length)));
  if (c.style === "photo" && c.photo) {
    const b = c.box ?? DEFAULT_SIGN.box!;
    return (
      <div className="sg-photo">
        <img src={c.photo} alt="" />
        <span style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, fontFamily: `'${c.font || "Oswald"}', system-ui, sans-serif`, color: c.color || "#121214", fontSize: `${size * 9}cqw` }}>{t}</span>
      </div>
    );
  }
  return (
    <div className={`sg sg-${c.style}`}>
      <span style={{ fontSize: `${size * (c.style === "hex" ? 7.5 : 8)}cqw` }}>{t}</span>
    </div>
  );
}
