"use client";

import { useActionState } from "react";
import { acceptInvite, type InviteState } from "@/app/actions/team";

export default function AcceptForm({ token, email, google }: { token: string; email: string; google: boolean }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined as InviteState);
  return (
    <form action={action} className="card" style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="token" value={token} />
      <label className="field">Email<input className="input" value={email} readOnly disabled /></label>
      <label className="field">Votre nom<input className="input" name="name" autoComplete="name" required placeholder="Prénom Nom" /></label>
      <label className="field">Choisissez un mot de passe<input className="input" type="password" name="password" autoComplete="new-password" required minLength={8} /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn btn-main" disabled={pending}>{pending ? "Un instant…" : "Activer mon compte"}</button>
      {google && (
        <>
          <div className="sep-or"><span>ou</span></div>
          <a className="btn btn-out btn-google" href={`/auth/google?invite=${encodeURIComponent(token)}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8z"/></svg>
            Continuer avec Google
          </a>
        </>
      )}
    </form>
  );
}
