"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGE, requireMembership } from "@/lib/auth";
import type { ActionState } from "./club";

/* Configuration guidée (/app/configuration) : quelques réglages groupés pour aller vite. */

const Steps = ["ambiance", "paiements-plus-tard"] as const;

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
})).min(1).max(12);

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
    await db.show.create({
      data: {
        venueId: venue.id, name: s.name, description: s.description || null, priceCents: Math.round(s.priceEuros * 100),
        isSign: !!s.isSign, categories: { connect: cats },
      },
    });
    n++;
  }
  revalidatePath("/app/configuration");
  revalidatePath("/app/shows");
  return { ok: n ? `${n} show${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}.` : "Ces shows sont déjà à votre carte." };
}
