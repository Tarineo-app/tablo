import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import PlanEditor from "./PlanEditor";

export const metadata = { title: "Plan · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const [cats, tables] = await Promise.all([
    db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, minSpendCents: true, color: true, elevation: true } }),
    db.venueTable.findMany({ where: { venueId: venue.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <header>
        <h1>Plan des carrés</h1>
        <p>Importez une photo ou un plan de votre salle, puis placez vos carrés : glissez pour déplacer, tirez le coin blanc pour agrandir. Ajoutez une photo par carré : elle s&apos;affiche dans la vue 3D quand le client le choisit.</p>
      </header>
      {cats.length === 0 ? (
        <p className="card">Créez d&apos;abord vos catégories de carré.</p>
      ) : (
        <PlanEditor
          categories={cats}
          initialImage={venue.planImageUrl}
          initialTables={tables.map((t) => ({ id: t.id, name: t.name, categoryId: t.categoryId, capacity: t.capacity, minSpendCents: t.minSpendCents, photoUrl: t.photoUrl, x: t.x, y: t.y, w: t.w, h: t.h }))}
          view={{ plan3d: venue.plan3d, planTilt: venue.planTilt, wallColor: venue.wallColor, tour3dUrl: venue.tour3dUrl }}
          slug={venue.slug}
        />
      )}
    </>
  );
}
