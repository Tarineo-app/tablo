"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGE, requireMembership } from "@/lib/auth";
import { catalogById } from "@/lib/catalog";
import { db } from "@/lib/db";
import { isImageValue, persistImage } from "@/lib/storage";
import type { ActionState } from "./club";

const refresh = () => { revalidatePath("/app/bouteilles"); revalidatePath("/app/configuration"); };

/** Ajoute une bouteille du catalogue Tablo à la carte du club, avec les prix conseillés (modifiables ensuite). */
export async function addFromCatalog(catalogId: string): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const c = catalogById(catalogId);
  if (!c) return { error: "Bouteille inconnue." };
  const had = await db.bottle.findFirst({ where: { venueId: venue.id, catalogId: c.id } });
  if (had) {
    if (!had.active) await db.bottle.update({ where: { id: had.id }, data: { active: true } });
    refresh();
    return { ok: `${c.name} est sur votre carte.` };
  }
  await db.bottle.create({
    data: {
      venueId: venue.id, catalogId: c.id, name: c.name, type: c.type, description: c.description, photoUrl: c.image, flavors: c.flavors,
      sizes: { create: c.sizes.map((s) => ({ label: s.label, volume: s.volume, priceCents: s.priceCents, stock: null })) },
    },
  });
  refresh();
  return { ok: `${c.name} ajoutée à votre carte.` };
}

const SaveInput = z.object({
  active: z.boolean(),
  sizes: z.array(z.object({
    id: z.string().min(1),
    priceCents: z.number().int().min(0).max(10_000_000),
    stock: z.number().int().min(0).max(100_000).nullable(),
    remove: z.boolean().optional(),
  })).max(8),
  add: z.object({ label: z.string().trim().min(1).max(30), volume: z.string().trim().max(20), priceCents: z.number().int().min(1).max(10_000_000), stock: z.number().int().min(0).max(100_000).nullable() }).nullable().optional(),
});

/** Prix, stock par soirée et disponibilité d'une bouteille de la carte. */
export async function saveBottle(id: string, raw: z.infer<typeof SaveInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = SaveInput.safeParse(raw);
  if (!p.success) return { error: "Vérifiez les prix et les stocks." };
  const b = await db.bottle.findFirst({ where: { id, venueId: venue.id }, include: { sizes: true } });
  if (!b) return { error: "Bouteille introuvable." };
  const mine = new Set(b.sizes.map((s) => s.id));
  const keep = p.data.sizes.filter((s) => mine.has(s.id) && !s.remove);
  if (!keep.length && !p.data.add) return { error: "Gardez au moins un format." };
  await db.$transaction(async (tx) => {
    await tx.bottle.update({ where: { id }, data: { active: p.data.active } });
    for (const s of p.data.sizes) {
      if (!mine.has(s.id)) continue;
      if (s.remove) {
        const used = (await tx.orderItem.count({ where: { bottleSizeId: s.id } })) + (await tx.offerItem.count({ where: { bottleSizeId: s.id } })) + (await tx.garageItem.count({ where: { bottleSizeId: s.id } }));
        // Un format déjà vendu reste en base (historique), en rupture.
        if (used) await tx.bottleSize.update({ where: { id: s.id }, data: { stock: 0 } });
        else await tx.bottleSize.delete({ where: { id: s.id } });
      } else {
        await tx.bottleSize.update({ where: { id: s.id }, data: { priceCents: s.priceCents, stock: s.stock } });
      }
    }
    if (p.data.add) await tx.bottleSize.create({ data: { bottleId: id, label: p.data.add.label, volume: p.data.add.volume || "—", priceCents: p.data.add.priceCents, stock: p.data.add.stock } });
  });
  refresh();
  return { ok: "Enregistré." };
}

const OwnInput = z.object({
  name: z.string().trim().min(2, "Nom de la bouteille requis.").max(60),
  type: z.string().trim().max(40),
  volume: z.string().trim().max(20),
  label: z.string().trim().max(30),
  priceCents: z.number().int().min(1, "Indiquez un prix.").max(10_000_000),
  stock: z.number().int().min(0).max(100_000).nullable(),
  flavors: z.array(z.string().trim().min(1).max(30)).max(12),
  photo: z.string().max(760_000).nullable(),
});

/** La bouteille du club, avec sa photo déjà détourée dans le navigateur. */
export async function addOwnBottle(raw: z.infer<typeof OwnInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = OwnInput.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  let photoUrl: string | null = null;
  if (d.photo) {
    if (!isImageValue(d.photo)) return { error: "Photo au format PNG, JPG ou WebP." };
    try { photoUrl = await persistImage(venue.id, d.photo); } catch { return { error: "Photo trop lourde." }; }
  }
  await db.bottle.create({
    data: {
      venueId: venue.id, name: d.name, type: d.type || null, photoUrl, flavors: d.flavors,
      sizes: { create: [{ label: d.label || "Bouteille", volume: d.volume || "—", priceCents: d.priceCents, stock: d.stock }] },
    },
  });
  refresh();
  return { ok: `${d.name} ajoutée.` };
}

/** Change la photo d'une bouteille de la carte (déjà détourée dans le navigateur). */
export async function setBottlePhoto(id: string, photo: string | null): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (photo && (!isImageValue(photo) || photo.length > 760_000)) return { error: "Photo trop lourde ou dans un format non pris en charge." };
  let url: string | null = null;
  try { url = photo ? await persistImage(venue.id, photo) : null; } catch { return { error: "Photo trop lourde." }; }
  const r = await db.bottle.updateMany({ where: { id, venueId: venue.id }, data: { photoUrl: url } });
  if (!r.count) return { error: "Bouteille introuvable." };
  refresh();
  return { ok: "Photo enregistrée." };
}
