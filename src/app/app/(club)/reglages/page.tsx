import Link from "next/link";
import { saveVenueInfo } from "@/app/actions/club";
import ActionForm from "@/components/ActionForm";
import { MANAGE, requireMembership } from "@/lib/auth";
import { yesterday } from "@/lib/dates";
import { db } from "@/lib/db";

export const metadata = { title: "Réglages · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const [cats, tables, bottles, shows, events] = await Promise.all([
    db.tableCategory.count({ where: { venueId: venue.id } }),
    db.venueTable.count({ where: { venueId: venue.id, active: true } }),
    db.bottle.count({ where: { venueId: venue.id, active: true } }),
    db.show.count({ where: { venueId: venue.id, active: true } }),
    db.event.count({ where: { venueId: venue.id, isOpen: true, date: { gte: yesterday() } } }),
  ]);

  const steps: [string, string, boolean, string][] = [
    ["Ambiance et marque", "/app/ambiance", !!venue.theme, "Logo, couleurs, polices du widget"],
    ["Catégories de carré", "/app/categories", cats > 0, `${cats} catégorie(s)`],
    ["Plan des carrés", "/app/plan", tables > 0, `${tables} carré(s) placé(s)`],
    ["Bouteilles", "/app/bouteilles", bottles > 0, `${bottles} bouteille(s)`],
    ["Shows et pancarte", "/app/shows", shows > 0, `${shows} show(s)`],
    ["Soirées et billetterie", "/app/soirees", events > 0, `${events} soirée(s) à venir`],
    ["Intégrer le widget", "/app/integrer", tables > 0 && events > 0, "Script, lien bio, QR code"],
  ];
  const done = steps.filter((s) => s[2]).length;

  return (
    <>
      <header>
        <h1>Réglages du club</h1>
        <p>{done === steps.length ? "Tout est en place : votre widget vend." : `Configuration : ${done} étape sur ${steps.length}. Suivez la liste, dans l'ordre.`}</p>
      </header>
      <div className="grid2" style={{ alignItems: "start" }}>
        <section className="card" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Mise en route</h2>
          {steps.map(([label, href, ok, sub], i) => (
            <Link key={href} href={href} className="row" style={{ textDecoration: "none", padding: "10px 12px", borderRadius: 14, background: "var(--card2)" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, background: ok ? "var(--ok)" : "#2a2a32", color: ok ? "#06210f" : "#fff" }}>{ok ? "✓" : i + 1}</span>
              <span style={{ display: "grid" }}><b style={{ fontSize: 14 }}>{label}</b><span className="mute" style={{ fontSize: 12 }}>{sub}</span></span>
            </Link>
          ))}
        </section>
        <section className="card">
          <h2 style={{ fontSize: 18, marginBottom: 14 }}>Informations du club</h2>
          <ActionForm action={saveVenueInfo} submit="Enregistrer">
            <label className="field">Nom<input className="input" name="name" defaultValue={venue.name} required /></label>
            <label className="field">Ville<input className="input" name="city" defaultValue={venue.city ?? ""} /></label>
            <label className="field">Règles affichées aux clients (âge, tenue…)<textarea className="input" name="rules" rows={3} defaultValue={venue.rules ?? ""} /></label>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
