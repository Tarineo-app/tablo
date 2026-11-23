import { addShow, deleteShow } from "@/app/actions/club";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";

export const metadata = { title: "Shows · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const [shows, cats, bottles] = await Promise.all([
    db.show.findMany({ where: { venueId: venue.id, active: true }, include: { categories: { select: { name: true } }, bottle: { select: { name: true } } }, orderBy: [{ minBottles: "asc" }, { priceCents: "asc" }] }),
    db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" } }),
    db.bottle.findMany({ where: { venueId: venue.id, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <header>
        <h1>Shows et pancarte</h1>
        <p>Les shows cochés pour une catégorie peuvent être choisis offerts par le client, dans la limite des shows inclus de sa catégorie. Les autres sont vendus en plus. Cochez « pancarte » pour votre pancarte : le client y écrit son texte.</p>
        <p>Une <b style={{ color: "var(--text)" }}>option liée aux bouteilles</b> (couronne, cortège, défilé) apparaît directement dans le choix des bouteilles et ne se débloque qu&apos;au nombre de bouteilles demandé. Elle suit les mêmes règles : offerte si la catégorie le permet, sinon vendue.</p>
      </header>
      <section className="card" style={{ marginBottom: 18 }}>
        <table className="list">
          <thead><tr><th>Show</th><th>Prix</th><th>Condition</th><th>Peut être offert pour</th><th /></tr></thead>
          <tbody>
            {shows.length === 0 && <tr><td colSpan={5} className="mute">Aucun show pour l&apos;instant.</td></tr>}
            {shows.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b> {s.isSign && <span className="tag">Pancarte</span>}<br /><span className="mute">{s.description}</span></td>
                <td>{s.priceCents ? eur(s.priceCents) : "Gratuit"}</td>
                <td className="mute">{s.minBottles > 0 ? `À partir de ${s.minBottles} ${s.bottle?.name ?? "bouteilles"}` : "—"}</td>
                <td className="mute">{s.categories.map((c) => c.name).join(", ") || "Aucune (upsell uniquement)"}</td>
                <td><ConfirmButton label="Supprimer" confirm={`Supprimer ${s.name} ?`} run={deleteShow.bind(null, s.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ajouter un show</h2>
        <ActionForm action={addShow} submit="Ajouter le show" resetOnOk>
          <div className="grid3">
            <label className="field">Nom<input className="input" name="name" placeholder="Ex. Parade de sparklers" required /></label>
            <label className="field">Prix (€)<input className="input" name="price" inputMode="decimal" placeholder="80" /></label>
            <label className="field">Photo ou vidéo d&apos;aperçu (https)<input className="input" name="mediaUrl" placeholder="https://…" /></label>
          </div>
          <label className="field">Description<input className="input" name="description" placeholder="Ex. 6 sparklers apportés à la table avec la bouteille" /></label>
          <label className="row" style={{ gap: 8, fontSize: 14 }}><input type="checkbox" name="isSign" /> C&apos;est la pancarte du club (le client écrit son texte)</label>
          <fieldset className="field" style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14, margin: 0 }}>
            <legend style={{ padding: "0 6px" }}>Option liée aux bouteilles (facultatif)</legend>
            <div className="grid2">
              <label className="field">Bouteille concernée
                <select className="input" name="bottleId" defaultValue=""><option value="">N&apos;importe laquelle</option>{bottles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              </label>
              <label className="field">Nombre minimum de bouteilles<input className="input" name="minBottles" inputMode="numeric" defaultValue="0" placeholder="3" /></label>
            </div>
            <p className="mute" style={{ margin: "8px 0 0", fontSize: 13 }}>Laissez 0 pour un show classique. Exemple : « Couronne Moët » avec la bouteille Moët &amp; Chandon et 3 minimum.</p>
          </fieldset>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Peut être offert pour les catégories</legend>
            <div className="row">{cats.map((c) => <label key={c.id} className="row" style={{ gap: 6 }}><input type="checkbox" name="categories" value={c.id} /> {c.name} ({c.includedShows} inclus)</label>)}</div>
          </fieldset>
        </ActionForm>
      </section>
    </>
  );
}
