import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireMembership } from "@/lib/auth";
import CopyBox from "./CopyBox";

export const metadata = { title: "Intégrer · Tablo" };

export default async function Page() {
  const { venue } = await requireMembership();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${origin}/w/${venue.slug}`;
  const script = `<script src="${origin}/embed.js" data-venue="${venue.slug}" async></script>`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360 });
  return (
    <>
      <header>
        <h1>Intégrer le widget</h1>
        <p>Trois façons de vendre vos carrés : un bouton sur votre site, un lien pour Instagram, un QR code pour vos flyers.</p>
      </header>
      <div style={{ display: "grid", gap: 16 }}>
        <section className="card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ fontSize: 17 }}>1. Sur votre site</h2>
          <p className="mute" style={{ margin: 0 }}>Collez cette ligne juste avant la balise &lt;/body&gt; de votre site (WordPress, Wix, Webflow…). Un bouton « Réserver » apparaît en bas à droite.</p>
          <CopyBox value={script} />
        </section>
        <section className="card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ fontSize: 17 }}>2. Lien pour la bio Instagram</h2>
          <CopyBox value={link} />
        </section>
        <section className="card row" style={{ alignItems: "flex-start", gap: 24 }}>
          <img src={qr} alt="QR code de réservation" width={180} height={180} style={{ borderRadius: 12, background: "#fff" }} />
          <div style={{ display: "grid", gap: 10 }}>
            <h2 style={{ fontSize: 17 }}>3. QR code pour les flyers</h2>
            <p className="mute" style={{ margin: 0 }}>Imprimez-le sur vos flyers, vos tables ou à l&apos;entrée.</p>
            <a className="btn btn-out" href={qr} download={`tablo-${venue.slug}.png`} style={{ justifySelf: "start" }}>Télécharger le QR code</a>
          </div>
        </section>
      </div>
    </>
  );
}
