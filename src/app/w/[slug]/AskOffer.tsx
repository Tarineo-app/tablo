"use client";

import { useState, useTransition } from "react";
import { requestOffer } from "@/app/actions/offers";

/**
 * « Dites-nous ce que vous voulez, votre manager s'en occupe. »
 * Le client qui n'a pas envie de composer sa soirée laisse la main à un humain —
 * et c'est exactement là que le manager vend mieux qu'un formulaire.
 */
export default function AskOffer({ slug, eventId, tableId, guests, managerCode }: {
  slug: string; eventId: string; tableId: string | null; guests: number; managerCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", note: "" });
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  if (msg?.ok) return <div className="w-card w-asked"><b>C&apos;est noté.</b><p>{msg.ok}</p></div>;

  if (!open) {
    return (
      <button className="w-ask" onClick={() => setOpen(true)}>
        <b>Vous préférez qu&apos;on s&apos;occupe de tout ?</b>
        <small>Dites-nous l&apos;occasion et votre budget : votre manager vous fait une proposition sur mesure.</small>
      </button>
    );
  }

  return (
    <div className="w-card" style={{ display: "grid", gap: 10 }}>
      <b>Votre demande</b>
      <textarea className="w-input" rows={3} maxLength={600} placeholder="Anniversaire de ma sœur, on sera 8, budget autour de 1500 €, on aime le champagne rosé."
        value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <div className="w-grid2">
        <input className="w-input" placeholder="Votre nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="w-input" placeholder="Téléphone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <input className="w-input" placeholder="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      {msg?.error && <span className="w-err" role="alert">{msg.error}</span>}
      <div className="w-grid2">
        <button className="w-ghost" onClick={() => setOpen(false)}>Annuler</button>
        <button className="w-accept" disabled={pending} onClick={() => start(async () => {
          setMsg(null);
          const r = await requestOffer({
            slug, eventId, tableId, guests,
            note: f.note.trim() || null, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(),
            managerCode,
          });
          setMsg(r ?? null);
        })}>{pending ? "Un instant…" : "Demander une proposition"}</button>
      </div>
    </div>
  );
}
