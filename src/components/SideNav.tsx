"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "OWNER" | "DIRECTOR" | "MANAGER" | "SERVER" | "BARMAN";
const ALL: Role[] = ["OWNER", "DIRECTOR", "MANAGER", "SERVER", "BARMAN"];
const MGMT: Role[] = ["OWNER", "DIRECTOR"];

const LINKS: [string, string, Role[]][] = [
  ["/app", "Tableau de bord", ["OWNER", "DIRECTOR", "MANAGER"]],
  ["/app/reservations", "Réservations", ["OWNER", "DIRECTOR", "MANAGER"]],
  ["/app/service", "Service du soir", ALL],
  ["/app/entree", "Contrôle entrée", ALL],
  ["sep:Configurer", "Configurer", MGMT],
  ["/app/ambiance", "Ambiance et marque", MGMT],
  ["/app/categories", "Catégories de carré", MGMT],
  ["/app/plan", "Plan des carrés", MGMT],
  ["/app/bouteilles", "Bouteilles", MGMT],
  ["/app/shows", "Shows et pancarte", MGMT],
  ["/app/soirees", "Soirées et billetterie", MGMT],
  ["/app/equipe", "Équipe", MGMT],
  ["/app/integrer", "Intégrer le widget", MGMT],
];

export default function SideNav({ role }: { role: Role }) {
  const path = usePathname();
  return (
    <>
      {LINKS.filter(([, , roles]) => roles.includes(role)).map(([href, label]) =>
        href.startsWith("sep:") ? (
          <div key={href} className="sep">{label}</div>
        ) : (
          <Link key={href} href={href} className={`nav ${path === href || (href !== "/app" && path.startsWith(href + "/")) ? "on" : ""}`}>{label}</Link>
        ),
      )}
    </>
  );
}
