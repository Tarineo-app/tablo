"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/app", "Tableau de bord"],
  ["/app/reservations", "Réservations"],
  ["sep", "Configurer"],
  ["/app/ambiance", "Ambiance et marque"],
  ["/app/categories", "Catégories de carré"],
  ["/app/plan", "Plan des carrés"],
  ["/app/bouteilles", "Bouteilles"],
  ["/app/shows", "Shows et pancarte"],
  ["/app/soirees", "Soirées"],
  ["/app/integrer", "Intégrer le widget"],
];

export default function SideNav() {
  const path = usePathname();
  return (
    <>
      {LINKS.map(([href, label]) =>
        href === "sep" ? (
          <div key={label} className="sep">{label}</div>
        ) : (
          <Link key={href} href={href} className={`nav ${path === href ? "on" : ""}`}>{label}</Link>
        ),
      )}
    </>
  );
}
