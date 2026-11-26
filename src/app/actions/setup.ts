"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGE, requireMembership } from "@/lib/auth";
import { isImageValue, persistImage } from "@/lib/storage";
import type { ActionState } from "./club";

/* Configuration guidée (/app/configuration) : quelques réglages groupés pour aller vite. */

const Steps = ["ambiance", "paiements-plus-tard", "pancarte"] as const;

/** Note qu'une étape sans trace en base est faite (ambiance validée, paiements remis à plus tard). */
export async function markSetup(step: (typeof Steps)[number]): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (!Steps.includes(step)) return { error: "Étape inconnue." };
  const v = await db.venue.findUniqueOrThrow({ where: { id: venue.id }, select: { onboarding: true } });
  const ob = (v.onboarding && typeof v.onboarding === "object" ? v.onboarding : {}) as Record<string, unknown>;
  const done = new Set(Array.isArray(ob.done) ? (ob.done as string[]) : []);
  done.add(step);
  await db.venue.update({ where: { id: venue.id }, data: { onboarding: { ...ob, done: [...done] } } });
  revalidatePath("/app/configuration");
  return { ok: "C'est noté." };
}

const PlanInput = z.object({
  cats: z.array(z.object({
    id: z.string().min(1),
    count: z.number().int().min(0).max(60),
    minEuros: z.number().min(0).max(100000),
    depositPct: z.number().int().min(0).max(100),
    capacity: z.number().int().min(1).max(100),
  })).min(1).max(12),
});

/**
 * Prix des catégories + plan dessiné automatiquement : une rangée par catégorie (les plus chères
 * au fond), les carrés répartis sur la largeur. Le club l'ajuste ensuite dans « Plan des carrés ».
 * On ne redessine que s'il n'a encore aucun carré, pour ne jamais casser un plan déjà travaillé.
 */
export async function autoPlan(input: z.infer<typeof PlanInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = PlanInput.safeParse(input);
  if (!p.success) return { error: "Vérifiez les nombres de carrés et les prix." };
  const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, select: { id: true, name: true } });
  const byId = new Map(cats.map((c) => [c.id, c]));
  if (p.data.cats.some((c) => !byId.has(c.id))) return { error: "Catégorie inconnue." };
  const total = p.data.cats.reduce((a, c) => a + c.count, 0);
  if (total < 1) return { error: "Indiquez au moins un carré." };
  if (total > 120) return { error: "Plus de 120 carrés : placez-les plutôt dans « Plan des carrés »." };

  const existing = await db.venueTable.count({ where: { venueId: venue.id, active: true } });
  await db.$transaction(async (tx) => {
    for (const c of p.data.cats) {
      await tx.tableCategory.updateMany({ where: { id: c.id, venueId: venue.id }, data: { minSpendCents: Math.round(c.minEuros * 100), depositPct: c.depositPct } });
    }
    if (existing) return;
    // Rangées : 8 carrés au plus par rangée, une rangée de plus si besoin.
    const rows: { cat: (typeof p.data.cats)[number]; n: number; from: number }[] = [];
    for (const c of p.data.cats.filter((c) => c.count > 0)) {
      for (let done = 0; done < c.count; done += 8) rows.push({ cat: c, n: Math.min(8, c.count - done), from: done });
    }
    // Les rangées occupent toute la hauteur du plan, avec de l'air entre elles.
    const rowH = Math.min(24, 88 / rows.length);
    for (const [r, row] of rows.entries()) {
      const slot = 96 / row.n;
      const w = Math.min(16, slot * 0.7), h = Math.max(5, Math.min(15, rowH * 0.6));
      for (let i = 0; i < row.n; i++) {
        await tx.venueTable.create({
          data: {
            venueId: venue.id, categoryId: row.cat.id, name: `${byId.get(row.cat.id)!.name} ${row.from + i + 1}`.slice(0, 30),
            capacity: row.cat.capacity, x: +(2 + slot * i + (slot - w) / 2).toFixed(2), y: +(6 + r * rowH).toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2),
          },
        });
      }
    }
  });
  revalidatePath("/app/configuration");
  revalidatePath("/app/plan");
  return { ok: existing ? "Prix enregistrés. Votre plan existant est gardé." : `${total} carrés placés sur votre plan.` };
}

const ShowsInput = z.array(z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(160).optional(),
  priceEuros: z.number().min(0).max(10000),
  isSign: z.boolean().optional(),
  photo: z.string().max(1_200_000).nullable().optional(),
})).min(1).max(20);

/** Ajoute les shows choisis parmi les suggestions, proposables en « offert » dans toutes les catégories. */
export async function addSetupShows(input: z.infer<typeof ShowsInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = ShowsInput.safeParse(input);
  if (!p.success) return { error: "Vérifiez le nom et le prix de chaque show." };
  const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, select: { id: true } });
  const have = new Set((await db.show.findMany({ where: { venueId: venue.id }, select: { name: true } })).map((s) => s.name.toLowerCase()));
  let n = 0;
  for (const s of p.data) {
    if (have.has(s.name.toLowerCase())) continue;
    let mediaUrl: string | null = null;
    if (s.photo) {
      if (!isImageValue(s.photo)) return { error: "Photo au format PNG, JPG ou WebP." };
      try { mediaUrl = await persistImage(venue.id, s.photo); } catch { return { error: `Photo trop lourde pour ${s.name}.` }; }
    }
    await db.show.create({
      data: {
        venueId: venue.id, name: s.name, description: s.description || null, priceCents: Math.round(s.priceEuros * 100),
        isSign: !!s.isSign, mediaUrl, categories: { connect: cats },
      },
    });
    n++;
  }
  revalidatePath("/app/configuration");
  revalidatePath("/app/shows");
  return { ok: n ? `${n} show${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}.` : "Ces shows sont déjà à votre carte." };
}

/** Photo d'un show (ou de la pancarte) : les clients achètent ce qu'ils voient. */
export async function setShowPhoto(id: string, photo: string | null): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (photo && (!isImageValue(photo) || photo.length > 1_200_000)) return { error: "Photo trop lourde ou dans un format non pris en charge." };
  let url: string | null = null;
  try { url = photo ? await persistImage(venue.id, photo) : null; } catch { return { error: "Photo trop lourde." }; }
  const r = await db.show.updateMany({ where: { id, venueId: venue.id }, data: { mediaUrl: url } });
  if (!r.count) return { error: "Show introuvable." };
  revalidatePath("/app/configuration");
  revalidatePath("/app/shows");
  return { ok: "Photo enregistrée." };
}

/** Prix d'un show déjà à la carte (0 = offert à tous). */
export async function setShowPrice(id: string, priceEuros: number): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (!Number.isFinite(priceEuros) || priceEuros < 0 || priceEuros > 10000) return { error: "Prix invalide." };
  await db.show.updateMany({ where: { id, venueId: venue.id }, data: { priceCents: Math.round(priceEuros * 100) } });
  revalidatePath("/app/configuration");
  return { ok: "Prix enregistré." };
}

export async function removeShow(id: string): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const used = (await db.reservationShow.count({ where: { showId: id } })) + (await db.orderItem.count({ where: { showId: id } })) + (await db.offerItem.count({ where: { showId: id } }));
  if (used) await db.show.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
  else await db.show.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/configuration");
  return { ok: "Show retiré." };
}

/** La pancarte personnalisée : proposée ou non, et son prix. */
export async function saveSignShow(enabled: boolean, priceEuros: number): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (!Number.isFinite(priceEuros) || priceEuros < 0 || priceEuros > 10000) return { error: "Prix invalide." };
  const sign = await db.show.findFirst({ where: { venueId: venue.id, isSign: true } });
  if (sign) await db.show.update({ where: { id: sign.id }, data: { active: enabled, priceCents: Math.round(priceEuros * 100) } });
  else if (enabled) {
    const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, select: { id: true } });
    await db.show.create({ data: { venueId: venue.id, name: "Pancarte personnalisée", description: "Votre message porté jusqu'à votre table", priceCents: Math.round(priceEuros * 100), isSign: true, categories: { connect: cats } } });
  }
  revalidatePath("/app/configuration");
  revalidatePath("/app/shows");
  return { ok: "Pancarte enregistrée." };
}
