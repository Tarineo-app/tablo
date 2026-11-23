import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { eur } from "@/lib/money";
import CopyBox from "./integrer/CopyBox";

/** Accueil d'un manager commercial : son lien, son QR code, ses ventes et sa commission. */
export default async function ManagerHome({ membershipId, code, pct, slug }: { membershipId: string; code: string | null; pct: number; slug: string }) {
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${origin}/w/${slug}?m=${code}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 320 });
  const resa = await db.reservation.findMany({ where: { managerId: membershipId, status: { notIn: ["CANCELLED"] } }, select: { totalCents: true } });
  const sold = resa.reduce((a, r) => a + r.totalCents, 0);
  return (
    <>
      <header>
        <h1>Mon espace <span className="holo">manager</span></h1>
        <p>Partagez votre lien : chaque réservation faite avec lui vous est attribuée, et votre commission est calculée toute seule.</p>
      </header>
      <div className="grid3" style={{ marginBottom: 18 }}>
        <div className="card"><span className="mute">Mes réservations</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{resa.length}</div></div>
        <div className="card"><span className="mute">Montant vendu</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }}>{eur(sold)}</div></div>
        <div className="card"><span className="mute">Ma commission ({pct} %)</span><div style={{ font: "800 30px Unbounded", marginTop: 6 }} className="holo">{eur(Math.round((sold * pct) / 100))}</div></div>
      </div>
      <section className="card row" style={{ alignItems: "flex-start", gap: 24 }}>
        <img src={qr} alt="Mon QR code de réservation" width={170} height={170} style={{ borderRadius: 12, background: "#fff" }} />
        <div style={{ display: "grid", gap: 10, flex: 1, minWidth: 260 }}>
          <h2 style={{ fontSize: 17 }}>Mon lien de réservation</h2>
          <CopyBox value={link} />
          <p className="mute" style={{ margin: 0, fontSize: 14 }}>À mettre dans votre bio Instagram, à envoyer sur WhatsApp, ou à faire scanner en soirée.</p>
        </div>
      </section>
    </>
  );
}
