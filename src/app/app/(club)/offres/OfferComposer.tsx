"use client";

import { useMemo, useState, useTransition } from "react";
import { saveOffer } from "@/app/actions/offers";
import { eur } from "@/lib/money";

type Opt = { id: string; label: string; priceCents: number; flavors?: string[] };
type Line = { key: string; kind: "bottle" | "show"; id: string; flavor: string | null; quantity: number; offered: boolean };

export default function OfferComposer({ events, tables, bottles, shows }: {
  events: { id: string; label: string }[];
  tables: { id: string; label: string; capacity: number }[];
  bottles: Opt[];
  shows: Opt[];
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [tableId, setTableId] = useState<string>(tables[0]?.id ?? "");
  const [guests, setGuests] = useState(6);
  const [lines, setLines] = useState<Line[]>([]);
  const [signText, setSignText] = useState("");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [client, setClient] = useState({ name: "", phone: "", email: "" });
  const [days, setDays] = useState(7);
  const [res, setRes] = useState<{ error?: string; code?: string } | null>(null);
  const [pending, start] = useTransition();

  const priceOf = useMemo(() => new Map([...bottles, ...shows].map((o) => [o.id, o])), [bottles, shows]);
  const listCents = lines.reduce((a, l) => a + (priceOf.get(l.id)?.priceCents ?? 0) * l.quantity, 0);
  const billedCents = lines.reduce((a, l) => a + (l.offered ? 0 : (priceOf.get(l.id)?.priceCents ?? 0) * l.quantity), 0);
  const priceCents = price.trim() === "" ? billedCents : Math.round(parseFloat(price.replace(",", ".")) * 100) || 0;
  const gift = Math.max(0, listCents - priceCents);

  const add = (kind: "bottle" | "show") => {
    const first = (kind === "bottle" ? bottles : shows)[0];
    if (!first) return;
    setLines((l) => [...l, { key: crypto.randomUUID(), kind, id: first.id, flavor: null, quantity: 1, offered: false }]);
  };
  const patch = (key: string, p: Partial<Line>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const url = res?.code && typeof window !== "undefined" ? `${window.location.origin}/o/${res.code}` : "";

  if (res?.code) {
    return (
      <section className="card offerdone">
        <h2 style={{ marginTop: 0 }}>Votre offre est prête.</h2>
        <p className="mute">Envoyez ce lien à votre client. Il voit votre proposition à vos conditions, et il accepte sans créer de compte.</p>
        <code className="offerlink">{url}</code>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn btn-main" onClick={() => navigator.clipboard.writeText(url)}>Copier le lien</button>
          <a className="btn btn-out" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
          <a className="btn btn-out" href={url} target="_blank" rel="noreferrer">Voir ce que voit le client</a>
          <button className="btn btn-out" onClick={() => { setRes(null); setLines([]); setPrice(""); setMessage(""); setClient({ name: "", phone: "", email: "" }); }}>Faire une autre offre</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontSize: 17, margin: 0 }}>Composer une offre</h2>

      <div className="grid3">
        <label className="field">Soirée
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="field">Carré
          <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">À définir plus tard</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="field">Personnes
          <input className="input" type="number" min={1} max={100} value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <b style={{ flex: 1, minWidth: 160 }}>Ce que vous proposez</b>
          <button type="button" className="btn btn-out" onClick={() => add("bottle")}>+ Bouteille</button>
          <button type="button" className="btn btn-out" onClick={() => add("show")}>+ Show</button>
        </div>

        {lines.length === 0 && <p className="mute" style={{ margin: 0 }}>Ajoutez des bouteilles et des shows. Cochez « offert » sur ce que vous mettez en plus : c&apos;est ce que le client verra.</p>}

        {lines.map((l) => {
          const opts = l.kind === "bottle" ? bottles : shows;
          const cur = priceOf.get(l.id);
          return (
            <div key={l.key} className="offerline">
              <select className="input" value={l.id} onChange={(e) => patch(l.key, { id: e.target.value, flavor: null })}>
                {opts.map((o) => <option key={o.id} value={o.id}>{o.label} · {eur(o.priceCents)}</option>)}
              </select>
              {l.kind === "bottle" && (cur?.flavors?.length ?? 0) > 0 && (
                <select className="input" value={l.flavor ?? ""} onChange={(e) => patch(l.key, { flavor: e.target.value || null })}>
                  <option value="">Goût</option>
                  {cur!.flavors!.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
              {l.kind === "bottle" && (
                <input className="input" type="number" min={1} max={50} value={l.quantity} onChange={(e) => patch(l.key, { quantity: Number(e.target.value) || 1 })} style={{ width: 80 }} />
              )}
              <label className="row" style={{ gap: 6, fontSize: 13.5, whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={l.offered} onChange={(e) => patch(l.key, { offered: e.target.checked })} /> offert
              </label>
              <button type="button" className="btn btn-danger" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}>Retirer</button>
            </div>
          );
        })}

        <label className="field">Pancarte (offerte)
          <input className="input" value={signText} maxLength={40} placeholder="Joyeux anniversaire Sarah" onChange={(e) => setSignText(e.target.value)} />
        </label>
      </div>

      <div className="offerprice">
        <div>
          <span className="mute">Valeur à la carte</span>
          <b>{eur(listCents)}</b>
        </div>
        <label className="field">Votre prix (€)
          <input className="input" inputMode="decimal" placeholder={(billedCents / 100).toFixed(0)} value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <div>
          <span className="mute">Vous offrez</span>
          <b style={{ color: gift > 0 ? "var(--ok)" : undefined }}>{eur(gift)}</b>
        </div>
      </div>

      <div className="grid3">
        <label className="field">Nom du client<input className="input" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></label>
        <label className="field">Téléphone<input className="input" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></label>
        <label className="field">Email<input className="input" type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></label>
      </div>

      <label className="field">Votre mot
        <textarea className="input" rows={3} maxLength={600} value={message} placeholder="Salut Sarah, je t'ai gardé l'Impérial face à la scène. Je t'offre la pancarte et la couronne pour les 25 ans." onChange={(e) => setMessage(e.target.value)} />
      </label>

      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field" style={{ width: 150 }}>Valable (jours)
          <input className="input" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} />
        </label>
        <button className="btn btn-main" disabled={pending || !eventId} onClick={() => start(async () => {
          setRes(null);
          const r = await saveOffer({
            eventId, tableId: tableId || null, guests, signText: signText.trim() || null,
            lines: lines.map((l) => ({
              bottleSizeId: l.kind === "bottle" ? l.id : null,
              showId: l.kind === "show" ? l.id : null,
              flavor: l.flavor, quantity: l.quantity, offered: l.offered,
            })),
            priceCents, message: message.trim() || null,
            clientName: client.name.trim() || null, clientPhone: client.phone.trim() || null, clientEmail: client.email.trim() || null,
            days,
          });
          setRes(r ?? null);
        })}>{pending ? "Un instant…" : "Créer l'offre"}</button>
        {res?.error && <span className="err">{res.error}</span>}
      </div>
    </section>
  );
}
