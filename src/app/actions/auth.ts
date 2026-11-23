"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseLook, rememberLook } from "@/lib/look";
import { rateLimit } from "@/lib/ratelimit";
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
  const tooMany = await rateLimit("signup", "", 5, 60 * 60e3);
  if (tooMany) return { error: tooMany };
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cet email." };
  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  // Ce que le prospect a réglé sur la page d'accueil suit jusqu'à la création de son club.
  await rememberLook(parseLook(Object.fromEntries([...form.entries()].filter(([k]) => k.startsWith("look_")).map(([k, v]) => [k.slice(5), String(v)]))));
  await createSession(user.id);
  redirect("/app/nouveau-club");
}

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Email invalide."), password: z.string().min(1, "Mot de passe requis.") });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const tooMany = await rateLimit("login", parsed.data.email, 8, 10 * 60e3);
  if (tooMany) return { error: tooMany };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Comparaison même quand le compte n'existe pas : le temps de réponse ne dit pas
  // si l'email est connu.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user?.passwordHash || !ok) return { error: "Email ou mot de passe incorrect." };
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
