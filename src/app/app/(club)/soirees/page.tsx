import { yesterday } from "@/lib/dates";
import { addEvent, deleteEvent, toggleEvent } from "@/app/actions/club";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Soirées · Tablo" };
const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export default async function Page() {
  const { venue } = await requireMembership();
  const events = await db.event.findMany({ where: { venueId: venue.id, date: { gte: yesterday() } }, orderBy: { date: "asc" }, include: { _count: { select: { reservations: true } } } });
  return (
    <>
      <header>
        <h1>Soirées</h1>
        <p>Les dates où vos clients peuvent réserver. Fermez une soirée pour arrêter les réservations sans la supprimer.</p>
      </header>
      <section className="card" style={{ marginBottom: 18 }}>
        <table className="list">
          <thead><tr><th>Date</th><th>Nom de la soirée</th><th>Réservations</th><th>État</th><th /></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={5} className="mute">Aucune soirée à venir.</td></tr>}
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ textTransform: "capitalize" }}>{fmt(e.date)}</td>
                <td>{e.name || <span className="mute">—</span>}</td>
                <td>{e._count.reservations}</td>
                <td><ConfirmButton className="btn btn-out" label={e.isOpen ? "Ouverte" : "Fermée"} run={toggleEvent.bind(null, e.id)} /></td>
                <td><ConfirmButton label="Supprimer" confirm="Supprimer cette soirée ?" run={deleteEvent.bind(null, e.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ajouter une soirée</h2>
        <ActionForm action={addEvent} submit="Ajouter" resetOnOk>
          <div className="grid2">
            <label className="field">Date<input className="input" type="date" name="date" required /></label>
            <label className="field">Nom (facultatif)<input className="input" name="name" placeholder="Ex. Nuit Vénitienne" /></label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
