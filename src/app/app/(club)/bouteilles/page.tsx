import BottleStudio from "@/components/BottleStudio";
import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Bouteilles · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership(MANAGE);
  const bottles = await db.bottle.findMany({ where: { venueId: venue.id }, include: { sizes: { orderBy: { priceCents: "asc" } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <>
      <header>
        <h1>Bouteilles</h1>
        <p>Ajoutez les bouteilles du catalogue Tablo d&apos;un « + », ou les vôtres avec leur photo. Pour chaque format : votre prix, et combien vous pouvez en vendre par soirée (vide = illimité). « Pas en stock » la cache aux clients sans la supprimer.</p>
      </header>
      <BottleStudio bottles={bottles.map((b) => ({ id: b.id, name: b.name, type: b.type, photoUrl: b.photoUrl, active: b.active, catalogId: b.catalogId, flavors: b.flavors, sizes: b.sizes.map((s) => ({ id: s.id, label: s.label, volume: s.volume, priceCents: s.priceCents, stock: s.stock })) }))} />
    </>
  );
}
