import { requireMembership } from "@/lib/auth";
import { loadClients } from "@/lib/clients";
import { eur } from "@/lib/money";

export const metadata = { title: "Clients · Tablo" };

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { venue, membership } = await requireMembership(["OWNER", "DIRECTOR", "MANAGER"]);
  const mine = membership.role === "MANAGER";
  const all = await loadClients(venue.id, mine ? membership.id : undefined);
  const needle = (q ?? "").trim().toLowerCase();
  const clients = needle ? all.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(needle)) : all;

  const total = all.reduce((a, c) => a + c.spentCents, 0);
  const fideles = all.filter((c) => c.visits > 1).length;

  return (
    <>
      <header>
        <h1>{mine ? "Mes clients" : "Clients"}</h1>
        <p>Rempli tout seul à chaque réservation ou billet : qui revient, combien il dépense, ce qu&apos;il boit. Rien à saisir.</p>
      </header>

      <div className="grid3" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Clients connus</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{all.length}</div></div>
        <div className="card"><span className="mute">Clients qui reviennent</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{fideles}</div><span className="mute" style={{ fontSize: 12 }}>{all.length ? Math.round((fideles / all.length) * 100) : 0} % du fichier</span></div>
        <div className="card"><span className="mute">Dépensé au total</span><div style={{ font: "800 28px Unbounded", marginTop: 6 }}>{eur(total)}</div></div>
      </div>

      <form className="card row" style={{ marginBottom: 16, gap: 10 }}>
        <input className="input" name="q" defaultValue={q ?? ""} placeholder="Chercher un nom, un email, un téléphone" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-out">Chercher</button>
      </form>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="list">
          <thead><tr><th>Client</th><th>Carrés</th><th>Entrées</th><th>Dépensé</th><th>Dernière venue</th><th>Ses bouteilles</th><th>Manager</th></tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={7} className="mute">{all.length ? "Personne ne correspond à cette recherche." : "Le fichier se remplira à la première réservation."}</td></tr>}
            {clients.slice(0, 300).map((c, i) => (
              <tr key={c.key}>
                <td>
                  <b>{all.length >= 5 && i < 3 && !needle ? `${["🥇", "🥈", "🥉"][i]} ` : ""}{c.name}</b>
                  <div className="mute" style={{ fontSize: 12 }}>{c.email || c.phone}</div>
                  {c.occasions.length > 0 && <div className="mute" style={{ fontSize: 12 }}>Pancarte : {c.occasions.slice(0, 2).join(" · ")}</div>}
                </td>
                <td>{c.tables}</td>
                <td>{c.tickets}</td>
                <td><b>{eur(c.spentCents)}</b></td>
                <td>{jour(c.lastAt)}</td>
                <td style={{ fontSize: 13 }}>{c.bottles.length ? c.bottles.slice(0, 2).map((b) => `${b.quantity} × ${b.label}`).join(", ") : <span className="mute">—</span>}</td>
                <td>{c.managers.length ? <span className="tag soft">{c.managers[0]}</span> : <span className="mute">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
