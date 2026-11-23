"use client";

import { useActionState, useState } from "react";
import { addGarageItem, type GarageState } from "@/app/actions/garage";

type Size = { id: string; label: string };

/** Mettre une bouteille au garage. Le code sorti est à donner au client. */
export default function GarageForm({ sizes, prefill }: { sizes: Size[]; prefill?: { name?: string; email?: string; phone?: string } }) {
  const [state, action, pending] = useActionState(addGarageItem, undefined as GarageState);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div className="grid2">
        <label className="field">Bouteille
          <select className="input" name="bottleSizeId" required defaultValue="">
            <option value="" disabled>Choisir…</option>
            {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="field">Quantité<input className="input" name="quantity" inputMode="numeric" defaultValue={1} /></label>
        <label className="field">Nom du client<input className="input" name="ownerName" required defaultValue={prefill?.name ?? ""} placeholder="Sarah Martin" /></label>
        <label className="field">Téléphone<input className="input" name="ownerPhone" inputMode="tel" defaultValue={prefill?.phone ?? ""} /></label>
        <label className="field">Email<input className="input" name="ownerEmail" type="email" defaultValue={prefill?.email ?? ""} /></label>
        <label className="field">Goût (si la bouteille en a un)<input className="input" name="flavor" placeholder="Red Berry" /></label>
      </div>
      <label className="field">Note pour l&apos;équipe<input className="input" name="note" maxLength={160} placeholder="Entamée aux trois quarts, bouchon marqué 14" /></label>
      <div className="row">
        <button className="btn btn-main" disabled={pending}>{pending ? "…" : "Mettre au garage"}</button>
        {state?.error && <span className="err" role="alert">{state.error}</span>}
        {state?.ok && <span className="okmsg">{state.ok}</span>}
      </div>
      {state?.code && (
        <div className="row" style={{ gap: 10 }}>
          <b style={{ font: "800 26px Unbounded, sans-serif", letterSpacing: ".14em" }}>{state.code}</b>
          <button type="button" className="btn btn-out" onClick={() => { navigator.clipboard?.writeText(state.code!); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            {copied ? "Copié ✓" : "Copier le code"}
          </button>
          <span className="mute" style={{ fontSize: 13 }}>Le client le saisira dans le widget pour revenir la chercher.</span>
        </div>
      )}
    </form>
  );
}
