"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom."),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  await createSession(user.id);
  redirect("/app/nouveau-club");
}

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email invalide."), password: z.string().min(1, "Mot de passe requis.") });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return { error: "Email ou mot de passe incorrect." };
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
