"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnTicket, transferTicket, type ResaleState } from "@/app/actions/tickets";

/** Le client ne peut plus venir : il donne son billet, ou le rend au club. */
export default function Resale({ token, transfer, buyback, hours, pct }: { token: string; transfer: boolean; buyback: boolean; hours: number; pct: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<"none" | "give" | "back">("none");
  const [state, action, pending] = useActionState(transferTicket, undefined as ResaleState);
  const [back, setBack] = useState<ResaleState>();
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  if (!transfer && !buyback) return null;

  const link = state?.link ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.link}` : "";

  return (
    <div className="w-card" style={{ display: "grid", gap: 12 }}>
      {state?.link ? (
        <>
          <b>C&apos;est fait</b>
          <p className="w-sub" style={{ margin: 0, textTransform: "none" }}>{state.ok}</p>
          <div className="row" style={{ gap: 8 }}>
            <input className="w-input" readOnly value={link} style={{ flex: 1, minWidth: 180, fontSize: 13 }} onFocus={(e) => e.currentTarget.select()} />
            <button className="w-btn" style={{ minHeight: 42 }} onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? "Copié ✓" : "Copier"}</button>
          </div>
          <p className="w-sub" style={{ margin: 0, textTransform: "none", fontSize: 13 }}>Votre ancien code ne fonctionne plus. Réglez le prix entre vous : le club ne s&apos;en occupe pas.</p>
        </>
      ) : back?.ok ? (
        <><b>C&apos;est noté</b><p className="w-sub" style={{ margin: 0, textTransform: "none" }}>{back.ok}</p></>
      ) : open === "none" ? (
        <>
          <b>Vous ne pouvez plus venir ?</b>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {transfer && <button className="w-btn" style={{ minHeight: 42 }} onClick={() => setOpen("give")}>Donner mon billet</button>}
            {buyback && <button className="w-btn w-ghost" style={{ minHeight: 42 }} onClick={() => setOpen("back")}>Le rendre au club</button>}
          </div>
          <p className="w-sub" style={{ margin: 0, textTransform: "none", fontSize: 13 }}>
            {transfer && "Donner : le billet change de nom, vous vous arrangez entre vous. "}
            {buyback && `Rendre : jusqu'à ${hours} h avant la soirée, le club vous rembourse ${pct} %.`}
          </p>
        </>
      ) : open === "give" ? (
        <form action={action} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="token" value={token} />
          <b>À qui donnez-vous votre billet ?</b>
          <label className="w-field">Son nom<input className="w-input" name="name" required placeholder="Prénom Nom" /></label>
          <label className="w-field">Son email<input className="w-input" name="email" type="email" required /></label>
          <label className="w-field">Son téléphone (facultatif)<input className="w-input" name="phone" type="tel" /></label>
          {state?.error && <p className="w-err" role="alert">{state.error}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="w-btn" style={{ minHeight: 44 }} disabled={pending}>{pending ? "…" : "Transférer le billet"}</button>
            <button type="button" className="w-btn w-ghost" onClick={() => setOpen("none")}>Annuler</button>
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <b>Rendre votre billet au club</b>
          <p className="w-sub" style={{ margin: 0, textTransform: "none" }}>Votre place est remise en vente et le club vous rembourse {pct} % de ce que vous avez payé. C&apos;est définitif.</p>
          {back?.error && <p className="w-err" role="alert">{back.error}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="w-btn" style={{ minHeight: 44 }} disabled={busy}
              onClick={() => start(async () => { const r = await returnTicket(token); setBack(r); if (r?.ok) router.refresh(); })}>
              {busy ? "…" : "Oui, je rends mon billet"}
            </button>
            <button type="button" className="w-btn w-ghost" onClick={() => setOpen("none")}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
