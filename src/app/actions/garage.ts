"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MANAGE, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { garageExpiry, newGarageCode } from "@/lib/garage";
import { rateLimit } from "@/lib/ratelimit";

export type GarageState = { error?: string; ok?: string; code?: string } | undefined;

/* ---------- Côté client : retrouver sa bouteille avec son code ---------- */

export type GarageFound = {
  code: string;
  owner: string;
  label: string;
  quantity: number;
  flavor: string | null;
  note: string | null;
  expiresAt: string;
  minBottles: number;
  keepsMin: boolean;
};

export async function findGarage(slug: string, rawCode: string): Promise<{ error: string } | { item: GarageFound }> {
  const code = rawCode.trim().toUpperCase().slice(0, 12);
  if (code.length < 4) return { error: "Code trop court." };
  const tooMany = await rateLimit("garage", slug, 20, 10 * 60e3);
  if (tooMany) return { error: tooMany };

  const venue = await db.venue.findUnique({ where: { slug }, select: { id: true, garageEnabled: true, garageMinBottles: true, garageKeepsMin: true } });
  if (!venue?.garageEnabled) return { error: "Ce club ne garde pas de bouteilles." };

  const item = await db.garageItem.findFirst({ where: { code, venueId: venue.id }, include: { bottleSize: { include: { bottle: true } } } });
  if (!item) return { error: "Aucune bouteille avec ce code. Demandez-le au club." };
  if (item.status === "RETRIEVED") return { error: "Cette bouteille a déjà été reprise." };
  if (item.status === "EXPIRED" || item.expiresAt.getTime() < Date.now()) return { error: "Le délai de conservation est dépassé. Voyez avec le club." };

  return {
    item: {
      code: item.code,
      owner: item.ownerName,
      label: `${item.bottleSize.bottle.name} ${item.bottleSize.label}`,
      quantity: item.quantity,
      flavor: item.flavor,
      note: item.note,
      expiresAt: item.expiresAt.toISOString(),
      minBottles: venue.garageMinBottles,
      keepsMin: venue.garageKeepsMin,
    },
  };
}

/* ---------- Côté club : réglages ---------- */

const Settings = z.object({
  garageEnabled: z.string().optional(),
  garageKeepsMin: z.string().optional(),
  garageMinBottles: z.coerce.number().int().min(0).max(20),
  garageDays: z.coerce.number().int().min(1).max(365),
});

export async function saveGarageSettings(_: GarageState, form: FormData): Promise<GarageState> {
  const { venue } = await requireMembership(MANAGE);
  const p = Settings.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db.venue.update({
    where: { id: venue.id },
    data: {
      garageEnabled: p.data.garageEnabled === "on",
      garageKeepsMin: p.data.garageKeepsMin === "on",
      garageMinBottles: p.data.garageMinBottles,
      garageDays: p.data.garageDays,
    },
  });
  revalidatePath("/app/garage");
  return { ok: "Réglages enregistrés." };
}

/* ---------- Côté club : les bouteilles gardées ---------- */

const NewItem = z.object({
  bottleSizeId: z.string().min(1, "Choisissez une bouteille."),
  ownerName: z.string().trim().min(2, "Indiquez le nom du client.").max(80),
  ownerEmail: z.string().trim().toLowerCase().max(120).optional(),
  ownerPhone: z.string().trim().max(30).optional(),
  quantity: z.coerce.number().int().min(1).max(20),
  flavor: z.string().trim().max(40).optional(),
  note: z.string().trim().max(160).optional(),
  reservationId: z.string().max(40).optional(),
});

export async function addGarageItem(_: GarageState, form: FormData): Promise<GarageState> {
  const { venue } = await requireMembership();
  const p = NewItem.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const size = await db.bottleSize.findFirst({ where: { id: d.bottleSizeId, bottle: { venueId: venue.id } }, include: { bottle: true } });
  if (!size) return { error: "Cette bouteille n'est pas à votre carte." };

  const settings = await db.venue.findUnique({ where: { id: venue.id }, select: { garageDays: true, garageEnabled: true } });
  if (!settings?.garageEnabled) return { error: "Activez d'abord le garage dans les réglages ci-dessus." };

  const code = newGarageCode();
  await db.garageItem.create({
    data: {
      venueId: venue.id, code, bottleSizeId: size.id,
      ownerName: d.ownerName, ownerEmail: d.ownerEmail || "", ownerPhone: d.ownerPhone || "",
      quantity: d.quantity, flavor: d.flavor || null, note: d.note || null,
      expiresAt: garageExpiry(settings.garageDays),
    },
  });
  revalidatePath("/app/garage");
  revalidatePath("/app");
  return { ok: `${size.bottle.name} ${size.label} mise au garage pour ${d.ownerName}. Donnez-lui ce code :`, code };
}

export async function retrieveGarageItem(id: string) {
  const { venue } = await requireMembership();
  const item = await db.garageItem.findFirst({ where: { id, venueId: venue.id } });
  if (!item) return { error: "Bouteille introuvable." };
  await db.garageItem.update({
    where: { id },
    data: item.status === "RETRIEVED" ? { status: "STORED", retrievedAt: null } : { status: "RETRIEVED", retrievedAt: new Date() },
  });
  revalidatePath("/app/garage");
  return { ok: item.status === "RETRIEVED" ? "Remise au garage." : "Marquée reprise." };
}

export async function extendGarageItem(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const [item, settings] = await Promise.all([
    db.garageItem.findFirst({ where: { id, venueId: venue.id } }),
    db.venue.findUnique({ where: { id: venue.id }, select: { garageDays: true } }),
  ]);
  if (!item) return { error: "Bouteille introuvable." };
  await db.garageItem.update({ where: { id }, data: { expiresAt: garageExpiry(settings?.garageDays ?? 60), status: "STORED" } });
  revalidatePath("/app/garage");
  return { ok: "Délai prolongé." };
}

export async function deleteGarageItem(id: string) {
  const { venue } = await requireMembership(MANAGE);
  const used = await db.reservation.count({ where: { garageItemId: id } });
  if (used) {
    await db.garageItem.updateMany({ where: { id, venueId: venue.id }, data: { status: "RETRIEVED", retrievedAt: new Date() } });
    revalidatePath("/app/garage");
    return { ok: "Déjà liée à une réservation : marquée reprise." };
  }
  await db.garageItem.deleteMany({ where: { id, venueId: venue.id } });
  revalidatePath("/app/garage");
  return { ok: "Supprimée." };
}
