"use client";

import { useState, useTransition } from "react";
import { cancelOffer, emailOffer } from "@/app/actions/offers";

/** Copier le lien, le partager, ou annuler l'offre. */
export default function OfferRow({ offer }: { offer: { id: string; code: string; status: string; clientEmail?: string | null } }) {
  const [copied, setCopied] = useState(false);
  const [mail, setMail] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/o/${offer.code}`;
  const live = offer.status === "SENT" || offer.status === "REQUESTED";

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-out" onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}>{copied ? "Lien copié" : "Copier le lien"}</button>
      <a className="btn btn-out" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      {offer.status === "SENT" && offer.clientEmail && (
        <button className="btn btn-out" disabled={pending} onClick={() => start(async () => setMail((await emailOffer(offer.id)) ?? null))}>
          {mail?.ok ? "Email envoyé" : "Par email"}
        </button>
      )}
      {mail?.error && <span className="err" role="alert">{mail.error}</span>}
      {live && (
        <button className="btn btn-danger" disabled={pending} onClick={() => start(async () => { await cancelOffer(offer.id); })}>
          {pending ? "…" : "Annuler"}
        </button>
      )}
    </div>
  );
}
