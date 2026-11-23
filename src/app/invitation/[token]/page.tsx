import Link from "next/link";
import { db } from "@/lib/db";
import { readInvite } from "@/lib/invite";
import { ROLE_DESC, ROLE_LABEL } from "@/lib/roles";
import AcceptForm from "./AcceptForm";

export const metadata = { title: "Rejoindre l'équipe · Tablo" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await readInvite(token);
  const m = inv
    ? await db.membership.findUnique({ where: { userId_venueId: { userId: inv.userId, venueId: inv.venueId } }, include: { user: true, venue: true } })
    : null;

  if (!m) {
    return (
      <main className="auth">
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <Link href="/" className="logo"><i />tablo</Link>
          <h1 style={{ fontSize: 22 }}>Ce lien n&apos;est plus valable</h1>
          <p className="mute" style={{ margin: 0 }}>Les invitations expirent au bout de 7 jours. Demandez-en une nouvelle à votre directeur.</p>
          <Link className="btn btn-out" href="/connexion">Aller à la connexion</Link>
        </div>
      </main>
    );
  }

  if (m.user.passwordHash) {
    return (
      <main className="auth">
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <Link href="/" className="logo"><i />tablo</Link>
          <h1 style={{ fontSize: 22 }}>Votre compte est déjà actif</h1>
          <p className="mute" style={{ margin: 0 }}>Connectez-vous avec {m.user.email} pour rejoindre {m.venue.name}.</p>
          <Link className="btn btn-main" href="/connexion">Se connecter</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div style={{ display: "grid", gap: 14, width: "100%", maxWidth: 420 }}>
        <div style={{ display: "grid", gap: 6, justifyItems: "center", textAlign: "center" }}>
          <Link href="/" className="logo"><i />tablo</Link>
          <h1 style={{ fontSize: 24, margin: "8px 0 0" }}>{m.venue.name} vous invite</h1>
          <p className="mute" style={{ margin: 0 }}>Comme <b style={{ color: "var(--text)" }}>{ROLE_LABEL[m.role]}</b>. {ROLE_DESC[m.role]}</p>
        </div>
        <AcceptForm token={token} email={m.user.email} google={!!process.env.GOOGLE_CLIENT_ID} />
      </div>
    </main>
  );
}
