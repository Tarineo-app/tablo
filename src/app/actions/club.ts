"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGE, requireMembership, requireUser } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { forgetLook, readLook, themeFromLook } from "@/lib/look";
import { defaultTheme, AMBIANCES, MODES, GRADIENTS, HEAD_FONTS, TEXT_FONTS, type Theme } from "@/lib/theme";

export type ActionState = { error?: string; ok?: string } | undefined;

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "club";

/* ---------- Établissement ---------- */

const VenueSchema = z.object({
  name: z.string().trim().min(2, "Nom de l'établissement requis."),
  city: z.string().trim().max(80).optional(),
  kind: z.enum(["club", "beach"]),
});

export async function createVenue(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = VenueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, city, kind } = parsed.data;
  const look = await readLook();

  let slug = slugify(name);
  for (let i = 2; await db.venue.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;

  const cats =
    kind === "beach"
      ? [["Cabana", 50, 2, 1200], ["Lit balinais", 30, 1, 600], ["Transat", 0, 0, 150]]
      : [["Prestige", 50, 3, 1500], ["Scène", 30, 2, 800], ["Lounge", 20, 1, 400], ["Table haute", 0, 0, 150]];

  await db.venue.create({
    data: {
      name, city: city || null, kind, slug,
      theme: themeFromLook(kind, look),
      rules: kind === "beach" ? "18 ans et plus. Maillot accepté jusqu'à 20 h, tenue de soirée ensuite." : "18 ans et plus. Tenue correcte exigée.",
      memberships: { create: { userId: user.id, role: "OWNER" } },
      categories: { create: cats.map(([n, dep, inc, min], i) => ({ name: n as string, depositPct: dep as number, includedShows: inc as number, minSpendCents: (min as number) * 100, sortOrder: i })) },
    },
  });
  await forgetLook();
  redirect("/app");
}

const InfoSchema = z.object({ name: z.string().trim().min(2), city: z.string().trim().max(80).optional(), rules: z.string().trim().max(500).optional() });

export async function saveVenueInfo(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = InfoSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Vérifiez le nom de l'établissement." };
  await db.venue.update({ where: { id: venue.id }, data: { name: p.data.name, city: p.data.city || null, rules: p.data.rules || null } });
  revalidatePath("/app", "layout");
  return { ok: "Informations enregistrées." };
}

/* ---------- Ambiance / thème ---------- */

export async function saveTheme(theme: Theme): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const ok =
    /^#[0-9a-f]{6}$/i.test(theme.accent) &&
    theme.mode in MODES &&
    (theme.grad === "" || theme.grad in GRADIENTS) &&
    HEAD_FONTS.includes(theme.head) &&
    TEXT_FONTS.includes(theme.font) &&
    ["round", "pill", "square"].includes(theme.btn) &&
    (theme.amb in AMBIANCES || theme.amb === "perso");
  if (!ok) return { error: "Thème invalide." };
  const clean: Theme = {
    amb: theme.amb, accent: theme.accent, grad: theme.grad, mode: theme.mode, font: theme.font, head: theme.head, btn: theme.btn,
    fab: String(theme.fab || "Réserver").slice(0, 28),
    logoUrl: theme.logoUrl && /^(https:\/\/|data:image\/(png|jpeg|webp|svg\+xml);base64,)/.test(theme.logoUrl) && theme.logoUrl.length < 600_000 ? theme.logoUrl : null,
  };
  await db.venue.update({ where: { id: venue.id }, data: { theme: clean } });
  revalidatePath(`/w/${venue.slug}`);
  return { ok: "Ambiance enregistrée. Le widget est à jour." };
}

/* ---------- Catégories de carré ---------- */

const CatSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(40),
  depositPct: z.coerce.number().int().min(0).max(100),
  includedShows: z.coerce.number().int().min(0).max(10),
});

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = CatSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const data = { ...p.data, minSpendCents: toCents(form.get("minSpend")) };
  const id = String(form.get("id") || "");
  if (id) await db.tableCategory.updateMany({ where: { id, venueId: venue.id }, data });
  else await db.tableCategory.create({ data: { ...data, venueId: venue.id, sortOrder: await db.tableCategory.count({ where: { venueId: venue.id } }) } });
  revalidatePath("/app/categories");
  return { ok: "Catégorie enregistrée." };
}

export async function deleteCategory(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const used = await db.venueTable.count({ where: { categoryId: id, venueId: venue.id } });
  if (used) return { error: `Impossible : ${used} carré(s) utilisent cette catégorie.` };
  await db.tableCategory.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/categories");
  return { ok: "Catégorie supprimée." };
}

/* ---------- Plan ---------- */

const TableSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(30),
  categoryId: z.string().min(1),
  capacity: z.number().int().min(1).max(100),
  minSpendCents: z.number().int().min(0).nullable(),
  x: z.number().min(0).max(100), y: z.number().min(0).max(100), w: z.number().min(2).max(100), h: z.number().min(2).max(100),
});
const PlanSchema = z.object({ planImageUrl: z.string().max(3_000_000).nullable(), tables: z.array(TableSchema).max(200) });

export async function savePlan(input: z.infer<typeof PlanSchema>): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const p = PlanSchema.safeParse(input);
  if (!p.success) return { error: "Plan invalide : vérifiez le nom et la catégorie de chaque carré." };
  const cats = new Set((await db.tableCategory.findMany({ where: { venueId: venue.id }, select: { id: true } })).map((c) => c.id));
  if (p.data.tables.some((t) => !cats.has(t.categoryId))) return { error: "Un carré a une catégorie inconnue." };
  const img = p.data.planImageUrl;
  if (img && !/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(img)) return { error: "Image de plan invalide." };

  const existing = await db.venueTable.findMany({ where: { venueId: venue.id }, select: { id: true } });
  const keep = new Set(p.data.tables.filter((t) => t.id).map((t) => t.id));
  await db.$transaction(async (tx) => {
    await tx.venue.update({ where: { id: venue.id }, data: { planImageUrl: img } });
    for (const old of existing) {
      if (keep.has(old.id)) continue;
      // Un carré déjà réservé est désactivé plutôt que supprimé, pour garder l'historique.
      const booked = await tx.reservation.count({ where: { tableId: old.id } });
      if (booked) await tx.venueTable.update({ where: { id: old.id }, data: { active: false } });
      else await tx.venueTable.delete({ where: { id: old.id } });
    }
    for (const t of p.data.tables) {
      const data = { name: t.name, categoryId: t.categoryId, capacity: t.capacity, minSpendCents: t.minSpendCents, x: t.x, y: t.y, w: t.w, h: t.h, active: true };
      if (t.id && existing.some((e) => e.id === t.id)) await tx.venueTable.update({ where: { id: t.id }, data });
      else await tx.venueTable.create({ data: { ...data, venueId: venue.id } });
    }
  });
  revalidatePath("/app/plan");
  return { ok: "Plan enregistré." };
}

/* ---------- Bouteilles ---------- */

export async function addBottle(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const name = String(form.get("name") || "").trim();
  if (name.length < 2) return { error: "Nom de la bouteille requis." };
  const sizes = [0, 1, 2]
    .map((i) => ({ label: String(form.get(`label${i}`) || "").trim(), volume: String(form.get(`volume${i}`) || "").trim(), priceCents: toCents(form.get(`price${i}`)), stockRaw: String(form.get(`stock${i}`) || "").trim() }))
    .filter((s) => s.label && s.priceCents > 0)
    .map((s) => ({ label: s.label, volume: s.volume || "—", priceCents: s.priceCents, stock: s.stockRaw ? Math.max(0, parseInt(s.stockRaw, 10) || 0) : null }));
  if (!sizes.length) return { error: "Ajoutez au moins un format avec un prix." };
  const photoUrl = String(form.get("photoUrl") || "").trim();
  if (photoUrl && !/^https:\/\//.test(photoUrl)) return { error: "La photo doit être une adresse https://" };
  await db.bottle.create({
    data: {
      venueId: venue.id, name, type: String(form.get("type") || "").trim() || null, photoUrl: photoUrl || null,
      flavors: String(form.get("flavors") || "").split(",").map((f) => f.trim()).filter(Boolean).slice(0, 12),
      sizes: { create: sizes },
    },
  });
  revalidatePath("/app/bouteilles");
  return { ok: `${name} ajoutée.` };
}

export async function deleteBottle(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const used = await db.orderItem.count({ where: { bottleSize: { bottleId: id } } });
  if (used) await db.bottle.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
  else await db.bottle.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/bouteilles");
}

export async function toggleBottle(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const b = await db.bottle.findFirst({ where: { id, venueId: venue.id } });
  if (b) await db.bottle.update({ where: { id }, data: { active: !b.active } });
  revalidatePath("/app/bouteilles");
}

/* ---------- Shows ---------- */

export async function addShow(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const name = String(form.get("name") || "").trim();
  if (name.length < 2) return { error: "Nom du show requis." };
  const mediaUrl = String(form.get("mediaUrl") || "").trim();
  if (mediaUrl && !/^https:\/\//.test(mediaUrl)) return { error: "Le média doit être une adresse https://" };
  const catIds = form.getAll("categories").map(String);
  const valid = await db.tableCategory.findMany({ where: { venueId: venue.id, id: { in: catIds } }, select: { id: true } });
  // Option liée aux bouteilles (« couronne de 3 Moët ») : proposée à l'étape des bouteilles.
  const minBottles = Math.max(0, Math.min(50, parseInt(String(form.get("minBottles") || "0"), 10) || 0));
  const wantedBottle = String(form.get("bottleId") || "").trim();
  const bottle = wantedBottle ? await db.bottle.findFirst({ where: { id: wantedBottle, venueId: venue.id }, select: { id: true } }) : null;
  if (wantedBottle && !bottle) return { error: "Cette bouteille n'est pas à votre carte." };
  if (bottle && minBottles < 1) return { error: "Indiquez le nombre de bouteilles minimum pour cette option." };
  await db.show.create({
    data: {
      venueId: venue.id, name, description: String(form.get("description") || "").trim() || null, priceCents: toCents(form.get("price")),
      mediaUrl: mediaUrl || null, isSign: form.get("isSign") === "on",
      minBottles, bottleId: bottle?.id ?? null,
      categories: { connect: valid },
    },
  });
  revalidatePath("/app/shows");
  return { ok: `${name} ajouté.` };
}

export async function deleteShow(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const used = await db.reservationShow.count({ where: { showId: id } });
  if (used) await db.show.updateMany({ where: { id, venueId: venue.id }, data: { active: false } });
  else await db.show.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/shows");
}

/* ---------- Soirées ---------- */

export async function addEvent(_: ActionState, form: FormData): Promise<ActionState> {
  const { venue } = await requireMembership(MANAGE);
  const d = String(form.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Date invalide." };
  const date = new Date(`${d}T12:00:00Z`); // midi UTC : la date reste la même en heure de Paris
  if (date.getTime() < Date.now() - 864e5) return { error: "Cette date est passée." };
  if (await db.event.findFirst({ where: { venueId: venue.id, date } })) return { error: "Une soirée existe déjà à cette date." };
  await db.event.create({ data: { venueId: venue.id, date, name: String(form.get("name") || "").trim() || null } });
  revalidatePath("/app/soirees");
  return { ok: "Soirée ajoutée." };
}

export async function toggleEvent(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const e = await db.event.findFirst({ where: { id, venueId: venue.id } });
  if (e) await db.event.update({ where: { id }, data: { isOpen: !e.isOpen } });
  revalidatePath("/app/soirees");
}

export async function deleteEvent(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const used = await db.reservation.count({ where: { eventId: id } });
  if (used) await db.event.updateMany({ where: { id, venueId: venue.id }, data: { isOpen: false } });
  else await db.event.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/soirees");
}
