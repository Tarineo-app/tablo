import { addBottle, deleteBottle, toggleBottle } from "@/app/actions/club";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";

export const metadata = { title: "Bouteilles · Tablo" };

const PRESETS = [["Classique", "75 cl"], ["Magnum", "1,5 L"], ["Jéroboam", "3 L"]];

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const bottles = await db.bottle.findMany({ where: { venueId: venue.id }, include: { sizes: { orderBy: { priceCents: "asc" } } }, orderBy: { name: "asc" } });
  return (
    <>
      <header>
        <h1>Bouteilles</h1>
        <p>Votre carte, avec vos prix. Pour chaque bouteille : jusqu&apos;à 3 formats, un stock facultatif et des goûts si besoin. Les photos détourées automatiquement arriveront avec le stockage des images.</p>
      </header>
      <section className="card" style={{ marginBottom: 18 }}>
        <table className="list">
          <thead><tr><th>Bouteille</th><th>Formats et prix</th><th>Goûts</th><th>État</th><th /></tr></thead>
          <tbody>
            {bottles.length === 0 && <tr><td colSpan={5} className="mute">Aucune bouteille pour l&apos;instant.</td></tr>}
            {bottles.map((b) => (
              <tr key={b.id} style={{ opacity: b.active ? 1 : 0.5 }}>
                <td><div className="row" style={{ gap: 10 }}>{b.photoUrl && <img src={b.photoUrl} alt="" style={{ width: 28, height: 48, objectFit: "contain" }} />}<span><b>{b.name}</b><br /><span className="mute">{b.type}</span></span></div></td>
                <td>{b.sizes.map((s) => <div key={s.id}>{s.label} {s.volume} · <b>{eur(s.priceCents)}</b>{s.stock != null && <span className="mute"> · stock {s.stock}</span>}</div>)}</td>
                <td className="mute">{b.flavors.join(", ") || "—"}</td>
                <td><ConfirmButton className="btn btn-out" label={b.active ? "En vente" : "Masquée"} run={toggleBottle.bind(null, b.id)} /></td>
                <td><ConfirmButton label="Supprimer" confirm={`Supprimer ${b.name} ?`} run={deleteBottle.bind(null, b.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ajouter une bouteille</h2>
        <ActionForm action={addBottle} submit="Ajouter la bouteille" resetOnOk>
          <div className="grid3">
            <label className="field">Nom<input className="input" name="name" placeholder="Ex. Champagne brut" required /></label>
            <label className="field">Type<input className="input" name="type" placeholder="Champagne, vodka…" /></label>
            <label className="field">Goûts (séparés par des virgules)<input className="input" name="flavors" placeholder="Original, Pêche, Ananas" /></label>
          </div>
          <label className="field">Photo (adresse https, facultatif)<input className="input" name="photoUrl" placeholder="https://…" /></label>
          {PRESETS.map(([l, v], i) => (
            <div key={i} className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <label className="field">Format {i + 1}<input className="input" name={`label${i}`} defaultValue={i === 0 ? l : ""} placeholder={l} /></label>
              <label className="field">Contenance<input className="input" name={`volume${i}`} defaultValue={i === 0 ? v : ""} placeholder={v} /></label>
              <label className="field">Prix (€)<input className="input" name={`price${i}`} inputMode="decimal" placeholder={i === 0 ? "180" : ""} /></label>
              <label className="field">Stock (vide = illimité)<input className="input" name={`stock${i}`} inputMode="numeric" /></label>
            </div>
          ))}
        </ActionForm>
      </section>
    </>
  );
}
