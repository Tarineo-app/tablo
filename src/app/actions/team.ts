"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { MANAGE, requireMembership } from "@/lib/auth";
import { readInvite, signInvite } from "@/lib/invite";
import { createSession } from "@/lib/session";
import { INVITABLE, ROLE_LABEL } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";

export type InviteState = { error?: string; ok?: string; link?: string } | undefined;

const newManagerCode = () => randomBytes(4).toString("hex");

async function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Envoie l'invitation par email si Resend est configuré. Sinon, le lien est affiché pour être copié. */
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendInviteEmail(to: string, venueName: string, role: Role, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "Tablo <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, subject: `${venueName} vous invite sur Tablo`,
      html: `<p>Bonjour,</p><p>${esc(venueName)} vous invite à rejoindre son espace Tablo en tant que <b>${esc(ROLE_LABEL[role])}</b>.</p><p><a href="${esc(link)}">Activer mon compte</a> (lien valable 7 jours)</p>`,
    }),
  }).catch(() => null);
  return !!r?.ok;
}

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide."),
  name: z.string().trim().max(80).optional(),
  role: z.enum(["DIRECTOR", "MANAGER", "SERVER", "BARMAN"]),
  commissionPct: z.coerce.number().int().min(0).max(50).optional(),
});

export async function inviteMember(_: InviteState, form: FormData): Promise<InviteState> {
  const { venue, membership } = await requireMembership(MANAGE);
  const p = InviteSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { email, name, role, commissionPct } = p.data;
  if (role === "DIRECTOR" && membership.role !== "OWNER") return { error: "Seul le propriétaire peut inviter un directeur." };

  let user = await db.user.findUnique({ where: { email } });
  if (user && (await db.membership.findUnique({ where: { userId_venueId: { userId: user.id, venueId: venue.id } } })))
    return { error: "Cette personne fait déjà partie de l'équipe." };
  if (!user) user = await db.user.create({ data: { email, name: name || email.split("@")[0] } });

  await db.membership.create({
    data: { userId: user.id, venueId: venue.id, role, managerCode: role === "MANAGER" ? newManagerCode() : null, commissionPct: role === "MANAGER" ? commissionPct ?? 10 : null },
  });
  revalidatePath("/app/equipe");

  if (user.passwordHash) return { ok: `${user.name ?? email} a déjà un compte Tablo : il voit ${venue.name} en se connectant.` };
  const link = `${await appOrigin()}/invitation/${await signInvite(user.id, venue.id)}`;
  const sent = await sendInviteEmail(email, venue.name, role, link);
  return { ok: sent ? `Invitation envoyée à ${email}.` : `Invitation créée. Envoyez ce lien à ${email} (valable 7 jours) :`, link: sent ? undefined : link };
}

export async function newInviteLink(membershipId: string): Promise<InviteState> {
  const { venue } = await requireMembership(MANAGE);
  const m = await db.membership.findFirst({ where: { id: membershipId, venueId: venue.id }, include: { user: true } });
  if (!m) return { error: "Membre introuvable." };
  if (m.user.passwordHash) return { ok: "Ce membre a déjà activé son compte." };
  return { ok: "Nouveau lien (valable 7 jours) :", link: `${await appOrigin()}/invitation/${await signInvite(m.userId, venue.id)}` };
}

export async function changeRole(membershipId: string, role: Role) {
  const { venue, membership } = await requireMembership(MANAGE);
  if (!INVITABLE.includes(role)) return { error: "Rôle invalide." };
  const m = await db.membership.findFirst({ where: { id: membershipId, venueId: venue.id } });
  if (!m || m.role === "OWNER") return { error: "Impossible de modifier le propriétaire." };
  if (m.id === membership.id) return { error: "Vous ne pouvez pas changer votre propre rôle." };
  if ((role === "DIRECTOR" || m.role === "DIRECTOR") && membership.role !== "OWNER") return { error: "Seul le propriétaire gère les directeurs." };
  await db.membership.update({ where: { id: m.id }, data: { role, managerCode: role === "MANAGER" ? m.managerCode ?? newManagerCode() : m.managerCode, commissionPct: role === "MANAGER" ? m.commissionPct ?? 10 : m.commissionPct } });
  revalidatePath("/app/equipe");
  return { ok: "Rôle modifié." };
}

export async function setCommission(membershipId: string, pct: number) {
  const { venue } = await requireMembership(MANAGE);
  const v = Math.max(0, Math.min(50, Math.round(pct)));
  await db.membership.updateMany({ where: { id: membershipId, venueId: venue.id, role: "MANAGER" }, data: { commissionPct: v } });
  revalidatePath("/app/equipe");
  return { ok: "Commission enregistrée." };
}

export async function removeMember(membershipId: string) {
  const { venue, membership } = await requireMembership(MANAGE);
  const m = await db.membership.findFirst({ where: { id: membershipId, venueId: venue.id } });
  if (!m || m.role === "OWNER") return { error: "Impossible de retirer le propriétaire." };
  if (m.id === membership.id) return { error: "Vous ne pouvez pas vous retirer vous-même." };
  if (m.role === "DIRECTOR" && membership.role !== "OWNER") return { error: "Seul le propriétaire peut retirer un directeur." };
  // Les réservations et envois gardent leur historique : on détache le membre avant de le retirer.
  await db.$transaction([
    db.reservation.updateMany({ where: { managerId: m.id }, data: { managerId: null } }),
    db.order.updateMany({ where: { takenById: m.id }, data: { takenById: null } }),
    db.ticket.updateMany({ where: { managerId: m.id }, data: { managerId: null } }),
    db.membership.delete({ where: { id: m.id } }),
  ]);
  revalidatePath("/app/equipe");
  return { ok: "Membre retiré." };
}

const AcceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

export async function acceptInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const p = AcceptSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const inv = await readInvite(p.data.token);
  if (!inv) return { error: "Ce lien d'invitation a expiré. Demandez-en un nouveau à votre directeur." };
  const user = await db.user.findUnique({ where: { id: inv.userId } });
  const m = user && (await db.membership.findUnique({ where: { userId_venueId: { userId: user.id, venueId: inv.venueId } } }));
  if (!user || !m) return { error: "Cette invitation n'est plus valable." };
  if (user.passwordHash) return { error: "Ce compte est déjà activé : connectez-vous." };
  await db.user.update({ where: { id: user.id }, data: { name: p.data.name, passwordHash: await bcrypt.hash(p.data.password, 10) } });
  await createSession(user.id);
  redirect("/app");
}
