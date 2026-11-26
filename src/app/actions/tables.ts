"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGE, refuseInDemo, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { occupying } from "@/lib/holds";
import { rateLimit } from "@/lib/ratelimit";
import { isImageValue, persistImage } from "@/lib/storage";
import type { ActionState } from "./club";

/* Carrés un par un, depuis la configuration : nom, places, photo, ajout, retrait, et import d'un plan analysé par l'IA. */

const refresh = () => { revalidatePath("/app/configuration"); revalidatePath("/app/plan"); revalidatePath("/app"); };

const TableInput = z.object({
  name: z.string().trim().min(1, "Donnez un nom au carré.").max(30),
  capacity: z.number().int().min(1).max(100),
  minEuros: z.number().min(0).max(100000).nullable(),
});

export async function updateTable(id: string, raw: z.infer<typeof TableInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = TableInput.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const r = await db.venueTable.updateMany({
    where: { id, venueId: venue.id },
    data: { name: p.data.name, capacity: p.data.capacity, minSpendCents: p.data.minEuros === null ? null : Math.round(p.data.minEuros * 100) },
  });
  if (!r.count) return { error: "Carré introuvable." };
  refresh();
  return { ok: "Enregistré." };
}

/** Ajoute un carré dans une catégorie, posé à une place libre du plan (à ajuster ensuite dans « Plan des carrés »). */
export async function addTable(categoryId: string): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const cat = await db.tableCategory.findFirst({ where: { id: categoryId, venueId: venue.id } });
  if (!cat) return { error: "Catégorie inconnue." };
  const tables = await db.venueTable.findMany({ where: { venueId: venue.id, active: true }, select: { x: true, y: true, w: true, h: true, name: true, categoryId: true, capacity: true } });
  if (tables.length >= 150) return { error: "150 carrés au maximum." };
  const same = tables.filter((t) => t.categoryId === cat.id);
  const w = same[0]?.w ?? 12, h = same[0]?.h ?? 9;
  // Première place libre sur une grille, en évitant les carrés existants.
  const free = (x: number, y: number) => tables.every((t) => x + w <= t.x - 1 || x >= t.x + t.w + 1 || y + h <= t.y - 1 || y >= t.y + t.h + 1);
  let spot = { x: 44, y: 44 };
  search: for (let y = 4; y <= 96 - h; y += 4) for (let x = 3; x <= 97 - w; x += 3) if (free(x, y)) { spot = { x, y }; break search; }
  let n = same.length + 1;
  const names = new Set(tables.map((t) => t.name.toLowerCase()));
  while (names.has(`${cat.name} ${n}`.toLowerCase())) n++;
  await db.venueTable.create({
    data: { venueId: venue.id, categoryId: cat.id, name: `${cat.name} ${n}`.slice(0, 30), capacity: same[0]?.capacity ?? 6, x: spot.x, y: spot.y, w, h },
  });
  refresh();
  return { ok: `${cat.name} ${n} ajouté.` };
}

export async function removeTable(id: string): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const t = await db.venueTable.findFirst({ where: { id, venueId: venue.id } });
  if (!t) return { error: "Carré introuvable." };
  const booked = await db.reservation.count({ where: { tableId: id, event: { date: { gte: new Date(Date.now() - 12 * 3600e3) } }, ...occupying() } });
  if (booked) return { error: "Ce carré a des réservations à venir : bloquez-le plutôt soirée par soirée." };
  const history = await db.reservation.count({ where: { tableId: id } }) + await db.offer.count({ where: { tableId: id } });
  if (history) await db.venueTable.update({ where: { id }, data: { active: false } });
  else await db.venueTable.delete({ where: { id } });
  refresh();
  return { ok: `${t.name} retiré.` };
}

export async function setTablePhoto(id: string, photo: string | null): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  if (photo && (!isImageValue(photo) || photo.length > 1_200_000)) return { error: "Photo trop lourde ou dans un format non pris en charge." };
  let url: string | null = null;
  try { url = photo ? await persistImage(venue.id, photo) : null; } catch { return { error: "Photo trop lourde." }; }
  const r = await db.venueTable.updateMany({ where: { id, venueId: venue.id }, data: { photoUrl: url } });
  if (!r.count) return { error: "Carré introuvable." };
  refresh();
  return { ok: "Photo enregistrée." };
}

/* ---------- Import du plan, analysé par l'IA ---------- */

export type FoundTable = { name: string; category: string; seats: number; x: number; y: number; w: number; h: number };
export type PlanAnalysis = { error: string } | { tables: FoundTable[]; note?: string };


const Found = z.object({
  tables: z.array(z.object({
    name: z.string().trim().min(1).max(30),
    category: z.string().trim().max(30).default(""),
    seats: z.number().int().min(1).max(60).catch(6),
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
  })).max(150),
  note: z.string().max(400).optional(),
});

/**
 * L'IA lit la photo ou la capture du plan et repère chaque carré : son nom ou numéro, sa catégorie, ses places
 * et sa position (en % de l'image). Rien n'est enregistré ici : le club vérifie, corrige, puis valide.
 */
export async function analyzePlan(image: string): Promise<PlanAnalysis> {
  const { venue } = await requireMembership(MANAGE);
  const denied = await refuseInDemo();
  if (denied) return denied;
  const tooMany = await rateLimit("plan-ia", venue.id, 12, 3600e3);
  if (tooMany) return { error: tooMany };
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { error: "L'analyse automatique n'est pas encore activée : votre plan est gardé en fond, et vos carrés se placent à la main." };
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(image);
  if (!m || image.length > 6_000_000) return { error: "Plan au format PNG, JPG ou WebP, 4 Mo maximum." };
  const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" }, select: { name: true } });
  const prompt = [
    "Voici le plan d'une salle de discothèque ou d'un beach club (photo, capture ou dessin).",
    "Repère chaque carré VIP, table, banquette, lit ou transat réservable. Ignore le bar, la piste, la cabine DJ, les toilettes, les escaliers et les murs.",
    `Catégories du club, de la plus chère à la moins chère : ${cats.map((c) => c.name).join(", ") || "Prestige, Scène, Lounge, Table haute"}.`,
    "Pour chaque emplacement, donne : name (le nom ou numéro écrit sur le plan, sinon un nom court comme « L4 »), category (une des catégories ci-dessus, choisie d'après la taille, la position près de la scène ou la légende du plan), seats (nombre de places estimé), et sa boîte englobante x, y, w, h en pourcentage de la largeur et de la hauteur de l'image (0 à 100, x et y = coin haut gauche).",
    "Réponds uniquement avec un objet JSON : {\"tables\": [...], \"note\": \"une phrase sur ce qui était difficile à lire, ou vide\"}.",
  ].join("\n");
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }, { type: "text", text: prompt }] }],
      }),
    });
  } catch {
    return { error: "L'analyse n'a pas pu se lancer. Réessayez dans un instant." };
  }
  if (!res.ok) {
    console.error("[plan-ia]", res.status, (await res.text()).slice(0, 300));
    return { error: "L'analyse n'a pas abouti. Réessayez, ou placez vos carrés à la main." };
  }
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: z.infer<typeof Found>;
  try { parsed = Found.parse(JSON.parse(json)); } catch { return { error: "Le plan n'a pas pu être lu. Essayez une image plus nette, vue de dessus." }; }
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const tables = parsed.tables.map((t) => {
    const w = clamp(t.w, 1.5, 40), h = clamp(t.h, 1.5, 40);
    return { ...t, w, h, x: clamp(t.x, 0, 100 - w), y: clamp(t.y, 0, 100 - h) };
  });
  if (!tables.length) return { error: "Aucun carré repéré sur cette image. Essayez une image plus nette, vue de dessus." };
  return { tables, note: parsed.note || undefined };
}

const ApplyInput = z.object({
  image: z.string().max(6_000_000),
  replace: z.boolean(),
  tables: z.array(z.object({ name: z.string().trim().min(1).max(30), category: z.string().trim().max(30), seats: z.number().int().min(1).max(100), x: z.number().min(0).max(100), y: z.number().min(0).max(100), w: z.number().min(0.5).max(60), h: z.number().min(0.5).max(60) })).max(150),
});

/** Enregistre le plan importé en fond, et les carrés validés par le club. */
export async function applyPlan(raw: z.infer<typeof ApplyInput>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const denied = await refuseInDemo();
  if (denied) return denied;
  const p = ApplyInput.safeParse(raw);
  if (!p.success) return { error: "Plan invalide." };
  if (!isImageValue(p.data.image)) return { error: "Image de plan invalide." };
  let img: string | null;
  try { img = await persistImage(venue.id, p.data.image); } catch { return { error: "Image du plan trop lourde." }; }
  const cats = await db.tableCategory.findMany({ where: { venueId: venue.id }, orderBy: { sortOrder: "asc" } });
  const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
  const fallback = cats[cats.length - 1];
  if (!fallback) return { error: "Créez d'abord une catégorie." };
  const current = await db.venueTable.findMany({ where: { venueId: venue.id, active: true }, select: { id: true } });
  if (p.data.replace && current.length) {
    const booked = await db.reservation.count({ where: { tableId: { in: current.map((t) => t.id) }, event: { date: { gte: new Date(Date.now() - 12 * 3600e3) } }, ...occupying() } });
    if (booked) return { error: "Des carrés ont des réservations à venir : ajoutez les nouveaux sans remplacer l'ancien plan." };
  }
  await db.$transaction(async (tx) => {
    await tx.venue.update({ where: { id: venue.id }, data: { planImageUrl: img } });
    if (p.data.replace && current.length) {
      // Les carrés qui ont un historique restent en base, masqués ; les autres sont supprimés.
      for (const t of current) {
        const hist = await tx.reservation.count({ where: { tableId: t.id } }) + await tx.offer.count({ where: { tableId: t.id } });
        if (hist) await tx.venueTable.update({ where: { id: t.id }, data: { active: false } });
        else await tx.venueTable.delete({ where: { id: t.id } });
      }
    }
    for (const t of p.data.tables) {
      const cat = byName.get(t.category.toLowerCase()) ?? fallback;
      await tx.venueTable.create({ data: { venueId: venue.id, categoryId: cat.id, name: t.name, capacity: t.seats, x: t.x, y: t.y, w: t.w, h: t.h } });
    }
  });
  refresh();
  return { ok: `${p.data.tables.length} carrés enregistrés sur votre plan.` };
}
