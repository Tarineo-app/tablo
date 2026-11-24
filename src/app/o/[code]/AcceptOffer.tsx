"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptOffer, declineOffer } from "@/app/actions/offers";
import { eur } from "@/lib/money";

const PAY: Record<string, [string, string]> = {
  FULL: ["Tout payer", "Vous réglez la totalité maintenant."],
  CASH: ["Acompte", "Vous versez l'acompte, le reste sur place."],
};

export default function AcceptOffer({ code, slug, payModes, priceCents }: { code: string; slug: string; payModes: string[]; priceCents: number }) {
  const modes = payModes.filter((m) => PAY[m]);
  const [mode, setMode] = useState<"FULL" | "CASH">((modes[0] as "FULL") ?? "FULL");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (done) return <p className="w-sub" style={{ textTransform: "none" }}>C&apos;est noté, merci de votre réponse.</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {modes.length > 1 && (
        <div className="w-grid2">
          {modes.map((m) => (
            <button key={m} className={`w-opt ${mode === m ? "on" : ""}`} onClick={() => setMode(m as "FULL")}>
              <b>{PAY[m][0]}</b><small>{PAY[m][1]}</small>
            </button>
          ))}
        </div>
      )}
      {err && <span className="w-err" role="alert">{err}</span>}
      <button className="w-accept" disabled={pending} onClick={() => start(async () => {
        setErr(null);
        const r = await acceptOffer(code, mode);
        if (r.error) setErr(r.error);
        else if (r.token) router.push(`/w/${slug}/r/${r.token}`);
      })}>
        {pending ? "Un instant…" : `J'accepte · ${eur(priceCents)}`}
      </button>
      <button className="w-ghost" disabled={pending} onClick={() => start(async () => {
        await declineOffer(code);
        setDone(true);
      })}>
        Ce n&apos;est pas pour cette fois
      </button>
    </div>
  );
}
