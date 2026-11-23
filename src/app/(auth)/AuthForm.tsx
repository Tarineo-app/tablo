"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

type Props = {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
  google?: boolean;
  notice?: string;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8z"/></svg>
);

export default function AuthForm({ mode, action, google, notice }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";
  return (
    <main className="auth">
      <form action={formAction} className="card">
        <Link href="/" className="logo"><i />tablo</Link>
        <h1 style={{ fontSize: 24 }}>{signup ? "Créer l'espace de votre club" : "Connexion à l'espace club"}</h1>
        {notice && <p className="err" role="alert">{notice}</p>}
        {signup && (
          <label className="field">Votre nom<input className="input" name="name" autoComplete="name" required /></label>
        )}
        <label className="field">Email<input className="input" type="email" name="email" autoComplete="email" required /></label>
        <label className="field">Mot de passe<input className="input" type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : 1} /></label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button className="btn btn-main" disabled={pending}>{pending ? "Un instant…" : signup ? "Créer mon compte" : "Se connecter"}</button>
        {google && (
          <>
            <div className="sep-or"><span>ou</span></div>
            <a className="btn btn-out btn-google" href="/auth/google"><GoogleIcon />Continuer avec Google</a>
          </>
        )}
        <p className="mute" style={{ fontSize: 14, margin: 0 }}>
          {signup ? <>Déjà un compte ? <Link href="/connexion">Se connecter</Link></> : <>Pas encore de compte ? <Link href="/inscription">Créer l&apos;espace de mon club</Link></>}
        </p>
      </form>
    </main>
  );
}
