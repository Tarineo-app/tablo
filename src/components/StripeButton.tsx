"use client";

import { useActionState } from "react";

/** Bouton qui part chez Stripe (inscription, paiement, portail). Affiche l'erreur s'il y en a une. */
export default function StripeButton({
  action, label, main = true, disabled,
}: {
  action: () => Promise<{ error?: string } | undefined>;
  label: string;
  main?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async () => action(), undefined);
  return (
    <form action={formAction} className="row" style={{ gap: 12, alignItems: "center" }}>
      <button className={`btn ${main ? "btn-main" : ""}`} disabled={pending || disabled}>{pending ? "Ouverture de Stripe…" : label}</button>
      {state?.error && <span className="err" role="alert">{state.error}</span>}
    </form>
  );
}
