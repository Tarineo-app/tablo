import Link from "next/link";

/** Onglets « Carré VIP / Entrée », affichés quand le club vend aussi des entrées. */
export default function ModeTabs({ slug, kind, current, managerCode }: { slug: string; kind: string; current: "table" | "ticket"; managerCode: string | null }) {
  const q = managerCode ? `?m=${encodeURIComponent(managerCode)}` : "";
  return (
    <nav className="w-modes" aria-label="Que voulez-vous réserver ?">
      <Link href={`/w/${slug}${q}`} className={current === "table" ? "on" : ""} replace>{kind === "beach" ? "Emplacement VIP" : "Carré VIP"}</Link>
      <Link href={`/w/${slug}/billets${q}`} className={current === "ticket" ? "on" : ""} replace>Entrée</Link>
    </nav>
  );
}
