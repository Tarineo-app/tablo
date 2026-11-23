"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

type Props = {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
};

export default function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="auth">
      <form action={formAction} className="card">
        <Link href="/" className="logo"><i />tablo</Link>
        <h1 style={{ fontSize: 24 }}>{signup ? "Créer l'espace de votre club" : "Connexion à l'espace club"}</h1>
        {signup && (
          <label className="field">Votre nom<input className="input" name="name" autoComplete="name" required /></label>
        )}
        <label className="field">Email<input className="input" type="email" name="email" autoComplete="email" required /></label>
        <label className="field">Mot de passe<input className="input" type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : 1} /></label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button className="btn btn-main" disabled={pending}>{pending ? "Un instant…" : signup ? "Créer mon compte" : "Se connecter"}</button>
        <p className="mute" style={{ fontSize: 14, margin: 0 }}>
          {signup ? <>Déjà un compte ? <Link href="/connexion">Se connecter</Link></> : <>Pas encore de compte ? <Link href="/inscription">Créer l&apos;espace de mon club</Link></>}
        </p>
      </form>
    </main>
  );
}
