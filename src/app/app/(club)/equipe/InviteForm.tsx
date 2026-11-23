"use client";

import { useActionState, useState, useTransition } from "react";
import { changeRole, inviteMember, newInviteLink, removeMember, setCommission, type InviteState } from "@/app/actions/team";
import type { Role } from "@/generated/prisma/enums";

const INVITABLE: Role[] = ["DIRECTOR", "MANAGER", "SERVER", "BARMAN"];
const LABEL: Record<Role, string> = { OWNER: "Propriétaire", DIRECTOR: "Directeur", MANAGER: "Manager commercial", SERVER: "Serveur", BARMAN: "Barman" };

/** Affiche un lien d'invitation avec un bouton « Copier ». */
export function LinkBox({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="row" style={{ gap: 8, width: "100%" }}>
      <input className="input" readOnly value={value} style={{ flex: 1, minWidth: 220, fontSize: 13 }} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn btn-out" onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); }}>
        {done ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}

export function InviteForm({ canInviteDirector }: { canInviteDirector: boolean }) {
  const [state, action, pending] = useActionState(inviteMember, undefined as InviteState);
  const [role, setRole] = useState<Role>("SERVER");
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div className="grid2">
        <label className="field">Email de la personne<input className="input" type="email" name="email" required placeholder="prenom@club.fr" /></label>
        <label className="field">Son nom (facultatif)<input className="input" name="name" placeholder="Ex. Karim" /></label>
        <label className="field">Rôle
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {INVITABLE.filter((r) => r !== "DIRECTOR" || canInviteDirector).map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
          </select>
        </label>
        {role === "MANAGER" && (
          <label className="field">Sa commission (%)<input className="input" name="commissionPct" inputMode="numeric" defaultValue={10} /></label>
        )}
      </div>
      <div className="row">
        <button className="btn btn-main" disabled={pending}>{pending ? "Envoi…" : "Inviter"}</button>
        {state?.error && <span className="err" role="alert">{state.error}</span>}
        {state?.ok && <span className="okmsg">{state.ok}</span>}
      </div>
      {state?.link && <LinkBox value={state.link} />}
    </form>
  );
}

/** Actions sur une ligne de l'équipe : rôle, commission, lien, retrait. */
export function MemberRow({ id, role, commissionPct, canManage, activated }: { id: string; role: Role; commissionPct: number | null; canManage: boolean; activated: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<InviteState>();
  const run = (fn: () => Promise<InviteState | { error?: string; ok?: string }>) => start(async () => setMsg((await fn()) as InviteState));
  if (!canManage) return <span className="mute">—</span>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        <select className="input" style={{ minHeight: 36, width: "auto", fontSize: 13 }} defaultValue={role} disabled={pending}
          onChange={(e) => run(() => changeRole(id, e.target.value as Role))}>
          {INVITABLE.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
        </select>
        {role === "MANAGER" && (
          <label className="row" style={{ gap: 6, fontSize: 13 }}>
            <input className="input" style={{ minHeight: 36, width: 70, fontSize: 13 }} defaultValue={commissionPct ?? 10} inputMode="numeric" disabled={pending}
              onBlur={(e) => run(() => setCommission(id, Number(e.target.value)))} /> %
          </label>
        )}
        {!activated && <button type="button" className="btn btn-out" disabled={pending} onClick={() => run(() => newInviteLink(id))}>Lien d&apos;invitation</button>}
        <button type="button" className="btn btn-danger" disabled={pending}
          onClick={() => { if (window.confirm("Retirer cette personne de l'équipe ?")) run(() => removeMember(id)); }}>Retirer</button>
      </div>
      {msg?.error && <span className="err">{msg.error}</span>}
      {msg?.ok && <span className="okmsg">{msg.ok}</span>}
      {msg?.link && <LinkBox value={msg.link} />}
    </div>
  );
}
