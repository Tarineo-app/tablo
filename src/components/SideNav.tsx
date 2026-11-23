"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "OWNER" | "DIRECTOR" | "MANAGER" | "SERVER" | "BARMAN";
const ALL: Role[] = ["OWNER", "DIRECTOR", "MANAGER", "SERVER", "BARMAN"];
const MGMT: Role[] = ["OWNER", "DIRECTOR"];
const SELL: Role[] = ["OWNER", "DIRECTOR", "MANAGER"];

const LINKS: [string, string, Role[]][] = [
  ["/app", "Ce soir", SELL],
  ["/app/ventes", "Ventes", SELL],
  ["/app/clients", "Clients", SELL],
  ["/app/stats", "Statistiques", MGMT],
  ["/app/service", "Service du soir", ALL],
  ["/app/entree", "Contrôle entrée", ALL],
  ["/app/equipe", "Équipe", MGMT],
  ["sep:Réglages", "Réglages", MGMT],
  ["/app/soirees", "Soirées et billetterie", MGMT],
  ["/app/ambiance", "Ambiance et marque", MGMT],
  ["/app/categories", "Catégories de carré", MGMT],
  ["/app/plan", "Plan des carrés", MGMT],
  ["/app/bouteilles", "Bouteilles", MGMT],
  ["/app/shows", "Shows et pancarte", MGMT],
  ["/app/integrer", "Intégrer le widget", MGMT],
  ["/app/reglages", "Informations du club", MGMT],
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
