"use client";

import { useState, useTransition } from "react";

/** Bouton qui appelle une server action après confirmation, et affiche son message éventuel. */
export default function ConfirmButton({ run, label, confirm, className = "btn btn-danger" }: {
  run: () => Promise<{ error?: string; ok?: string } | void>;
  label: string;
  confirm?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  return (
    <span className="row" style={{ gap: 8 }}>
      <button type="button" className={className} disabled={pending}
        onClick={() => { if (confirm && !window.confirm(confirm)) return; start(async () => { const r = await run(); setErr(r && "error" in r ? r.error : undefined); }); }}>
        {pending ? "…" : label}
      </button>
      {err && <span className="err">{err}</span>}
    </span>
  );
}
