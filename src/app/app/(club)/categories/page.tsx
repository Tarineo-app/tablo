import { deleteCategory, saveCategory } from "@/app/actions/club";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Catégories · Tablo" };

function Fields({ c }: { c?: { id: string; name: string; depositPct: number; includedShows: number; minSpendCents: number } }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
        <label className="field">Nom<input className="input" name="name" defaultValue={c?.name} placeholder="Ex. Prestige" required /></label>
        <label className="field">Acompte obligatoire (%)<input className="input" type="number" name="depositPct" min={0} max={100} step={5} defaultValue={c?.depositPct ?? 30} required /></label>
        <label className="field">Shows inclus<input className="input" type="number" name="includedShows" min={0} max={10} defaultValue={c?.includedShows ?? 0} required /></label>
        <label className="field">Minimum (€)<input className="input" name="minSpend" inputMode="decimal" defaultValue={c ? c.minSpendCents / 100 : 500} /></label>
      </div>
    </>
  );
}

export default async function Page() {
  const { venue } = await requireMembership();
  const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { tables: true } } } });
  return (
    <>
      <header>
        <h1>Catégories de carré</h1>
        <p>Chaque catégorie fixe l&apos;acompte obligatoire, le nombre de shows offerts au client et le minimum de bouteilles par défaut. Un carré peut avoir son propre minimum sur le plan.</p>
      </header>
      <div style={{ display: "grid", gap: 14 }}>
        {cats.map((c) => (
          <section key={c.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 17 }}>{c.name}</h2>
              <span className="row"><span className="tag soft">{c._count.tables} carré(s)</span>
                <ConfirmButton label="Supprimer" confirm={`Supprimer la catégorie ${c.name} ?`} run={deleteCategory.bind(null, c.id)} /></span>
            </div>
            <ActionForm action={saveCategory} submit="Enregistrer"><Fields c={c} /></ActionForm>
          </section>
        ))}
        <section className="card" style={{ display: "grid", gap: 10, borderStyle: "dashed" }}>
          <h2 style={{ fontSize: 17 }}>Nouvelle catégorie</h2>
          <ActionForm action={saveCategory} submit="Ajouter" resetOnOk><Fields /></ActionForm>
        </section>
      </div>
    </>
  );
}
