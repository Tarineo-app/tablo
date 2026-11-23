"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/club";

/** Formulaire relié à une server action, avec message d'erreur ou de succès. */
export default function ActionForm({
  action, children, submit, className, resetOnOk,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (s: ActionState, f: FormData) => {
    const r = await action(s, f);
    if (resetOnOk && r?.ok) (document.activeElement as HTMLElement | null)?.closest("form")?.reset();
    return r;
  }, undefined);
  return (
    <form action={formAction} className={className} style={{ display: "grid", gap: 14 }}>
      {children}
      <div className="row">
        <button className="btn btn-main" disabled={pending}>{pending ? "Enregistrement…" : submit}</button>
        {state?.error && <span className="err" role="alert">{state.error}</span>}
        {state?.ok && <span className="okmsg">{state.ok}</span>}
      </div>
    </form>
  );
}
