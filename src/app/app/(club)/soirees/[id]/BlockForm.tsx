"use client";

import { useActionState } from "react";
import { blockTable, type FloorState } from "@/app/actions/floor";
import ConfirmButton from "@/components/ConfirmButton";
import { releaseTable } from "@/app/actions/floor";

type Table = { id: string; label: string };
type Held = { id: string; tableName: string; name: string; phone: string; guests: number };

/** Un carré vendu au téléphone ou en direct : on le sort de la vente en ligne. */
export default function BlockForm({ eventId, free, held }: { eventId: string; free: Table[]; held: Held[] }) {
  const [state, action, pending] = useActionState<FloorState, FormData>(blockTable, undefined);

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Carrés tenus hors application</h2>
      <p className="mute" style={{ marginTop: 0 }}>
        Un client a réservé au téléphone, en message ou au comptoir ? Bloquez son carré ici : il disparaît du widget
        tout de suite, et personne ne peut le vendre une deuxième fois.
      </p>

      {held.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table className="list">
            <thead><tr><th>Carré</th><th>Pour qui</th><th>Pers.</th><th /></tr></thead>
            <tbody>
              {held.map((h) => (
                <tr key={h.id}>
                  <td><b>{h.tableName}</b></td>
                  <td>{h.name}{h.phone && <><br /><small className="mute">{h.phone}</small></>}</td>
                  <td>{h.guests}</td>
                  <td><ConfirmButton label="Remettre en vente" confirm={`Remettre ${h.tableName} à la vente ?`} run={releaseTable.bind(null, h.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {free.length === 0 ? (
        <p className="mute" style={{ margin: 0 }}>Tous les carrés sont déjà pris pour cette soirée.</p>
      ) : (
        <form action={action} style={{ display: "grid", gap: 12 }}>
          <input type="hidden" name="eventId" value={eventId} />
          <div className="grid3">
            <label className="field">Carré
              <select className="input" name="tableId" required>
                {free.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="field">Pour qui<input className="input" name="name" required placeholder="Karim B." /></label>
            <label className="field">Téléphone<input className="input" name="phone" placeholder="06…" /></label>
          </div>
          <div className="grid3">
            <label className="field">Personnes<input className="input" name="guests" type="number" min={1} max={60} defaultValue={6} /></label>
            <label className="field">Minimum convenu (€)<input className="input" name="amount" inputMode="decimal" placeholder="1500" /></label>
            <label className="field">Venu par
              <select className="input" name="source" defaultValue="téléphone">
                <option value="téléphone">Téléphone</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="sur place">Sur place</option>
                <option value="">Autre</option>
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-main" disabled={pending}>{pending ? "Un instant…" : "Bloquer ce carré"}</button>
            {state?.error && <span className="err">{state.error}</span>}
            {state?.ok && <span className="okmsg">{state.ok}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
