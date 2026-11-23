"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { admit, lookupCode, type DoorResult } from "@/app/actions/tickets";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const getBD = () => (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;

/** Contrôle à l'entrée : code tapé ou QR scanné avec la caméra du téléphone. */
export default function Door() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<DoorResult>();
  const [msg, setMsg] = useState<string>();
  const [scan, setScan] = useState(false);
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);

  const check = (c: string) => start(async () => { setMsg(undefined); setRes(await lookupCode(c)); });

  // Scanner : API BarcodeDetector (Chrome Android, Safari récent). Sinon, on tape le code.
  useEffect(() => {
    if (!scan) return;
    const BD = getBD();
    if (!BD) return;
    let stream: MediaStream | undefined, stop = false;
    const det = new BD({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const found = await det.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) { setCode(found[0].rawValue); check(found[0].rawValue); setScan(false); break; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch { setMsg("Caméra indisponible : tapez le code."); setScan(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [scan]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = res && !("error" in res) ? res : null;
  const left = ok ? ok.quantity - ok.checkedIn : 0;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 560 }}>
      <form className="card row" onSubmit={(e) => { e.preventDefault(); check(code); }} style={{ gap: 10 }}>
        <input className="input" style={{ flex: 1, minWidth: 180, fontSize: 20, letterSpacing: ".12em", textTransform: "uppercase" }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code du billet" autoFocus autoCapitalize="characters" />
        <button className="btn btn-main" disabled={pending || code.trim().length < 6}>Vérifier</button>
        <button type="button" className="btn btn-out" onClick={() => { if (!scan && !getBD()) { setMsg("Ce navigateur ne sait pas lire les QR codes : tapez le code."); return; } setScan(!scan); }}>{scan ? "Arrêter" : "Scanner"}</button>
      </form>
      {scan && <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 16, background: "#000" }} />}
      {msg && <p className="mute">{msg}</p>}
      {res && "error" in res && <div className="card" style={{ borderColor: "#ff5a6e" }}><b style={{ color: "#ff5a6e", fontSize: 18 }}>✕ {res.error}</b></div>}
      {ok && (
        <div className="card" style={{ display: "grid", gap: 10, borderColor: ok.ok ? "#3ddc97" : "#ffb020", boxShadow: `0 0 0 2px ${ok.ok ? "#3ddc97" : "#ffb020"} inset` }}>
          <b style={{ fontSize: 22, color: ok.ok ? "#3ddc97" : "#ffb020" }}>{ok.ok ? "✓ Valide" : "⚠ À vérifier"}</b>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{ok.name}</div>
          <div className="mute">{ok.kind === "table" ? "Réservation de carré" : "Billet d'entrée"} · {ok.detail}</div>
          <div>{ok.checkedIn} / {ok.quantity} déjà entré{ok.checkedIn > 1 ? "s" : ""}</div>
          {ok.warnings.map((w) => <div key={w} style={{ color: "#ffb020", fontWeight: 700 }}>• {w}</div>)}
          {left > 0 && (
            <div className="row" style={{ gap: 8 }}>
              {ok.kind === "ticket" && left > 1 && <button className="btn btn-out" disabled={pending} onClick={() => start(async () => { await admit("ticket", ok.id, 1); setRes(await lookupCode(code)); })}>Faire entrer 1</button>}
              <button className="btn btn-main" disabled={pending} onClick={() => start(async () => { await admit(ok.kind, ok.id, left); setRes(await lookupCode(code)); setMsg(`${left} personne${left > 1 ? "s" : ""} entrée${left > 1 ? "s" : ""}.`); })}>
                Faire entrer {left > 1 ? `les ${left}` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
