import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireMembership } from "@/lib/auth";
import SideNav from "@/components/SideNav";
import { ROLE_LABEL, isManagement } from "@/lib/roles";


export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, venue, demo } = await requireMembership();
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/app" className="logo"><i />tablo</Link>
        <div className="venue"><b>{venue.name}</b><span className="mute">{ROLE_LABEL[membership.role]} · {user.name}</span></div>
        <SideNav role={membership.role} />
        <div style={{ flex: 1 }} />
        {isManagement(membership.role) && <a className="nav" href={`/w/${venue.slug}`} target="_blank" rel="noreferrer">Voir mon widget ↗</a>}
        <form action={logout}><button className="btn btn-out" style={{ width: "100%", marginTop: 8 }}>Se déconnecter</button></form>
        <p className="side-legal"><Link href="/cgv">CGV</Link> · <Link href="/confidentialite">Confidentialité</Link> · <Link href="/mentions-legales">Mentions</Link></p>
      </aside>
      <main className="main">
        {demo && (
          <div className="demobar">
            <span className="tag">Démonstration</span>
            <div>
              <b>Vous visitez un club inventé.</b>
              <em>Les soirées, les carrés et les réservations sont fictifs. Touchez à tout : rien n&apos;est réel.</em>
            </div>
            <a className="btn btn-main" href="/inscription">Créer mon espace</a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
