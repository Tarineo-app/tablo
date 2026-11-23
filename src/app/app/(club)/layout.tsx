import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireMembership } from "@/lib/auth";
import SideNav from "@/components/SideNav";
import { ROLE_LABEL, isManagement } from "@/lib/roles";


export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, venue } = await requireMembership();
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/app" className="logo"><i />tablo</Link>
        <div className="venue"><b>{venue.name}</b><span className="mute">{ROLE_LABEL[membership.role]} · {user.name}</span></div>
        <SideNav role={membership.role} />
        <div style={{ flex: 1 }} />
        {isManagement(membership.role) && <a className="nav" href={`/w/${venue.slug}`} target="_blank" rel="noreferrer">Voir mon widget ↗</a>}
        <form action={logout}><button className="btn btn-out" style={{ width: "100%", marginTop: 8 }}>Se déconnecter</button></form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
