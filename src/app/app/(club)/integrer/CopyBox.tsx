"use client";

import { useState } from "react";

export default function CopyBox({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      <code style={{ flex: 1, padding: "12px 14px", borderRadius: 12, background: "#0c0c0f", border: "1px solid var(--line)", fontSize: 13, overflowX: "auto", whiteSpace: "nowrap" }}>{value}</code>
      <button type="button" className="btn btn-main" onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? "Copié" : "Copier"}</button>
    </div>
  );
}
