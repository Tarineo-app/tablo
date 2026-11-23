import Link from "next/link";
import { redirect } from "next/navigation";
import { createVenue } from "@/app/actions/club";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ActionForm from "@/components/ActionForm";

export const metadata = { title: "Nouvel établissement · Tablo" };

export default async function Page() {
  const user = await requireUser();
  if (await db.membership.findFirst({ where: { userId: user.id } })) redirect("/app");
  return (
    <main className="auth">
      <div className="card" style={{ width: "min(520px,100%)" }}>
        <Link href="/" className="logo"><i />tablo</Link>
        <h1 style={{ fontSize: 24 }}>Votre établissement</h1>
        <p className="mute" style={{ margin: 0, lineHeight: 1.6 }}>Bonjour {user.name}. On crée l&apos;espace de votre club : vous pourrez tout modifier ensuite.</p>
        <ActionForm action={createVenue} submit="Créer mon espace">
          <label className="field">Nom de l&apos;établissement<input className="input" name="name" placeholder="Ex. Le Velours" required /></label>
          <label className="field">Ville<input className="input" name="city" placeholder="Ex. Rouen" /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Type de lieu</legend>
            <div className="row">
              <label className="row" style={{ gap: 8 }}><input type="radio" name="kind" value="club" defaultChecked /> Club, discothèque</label>
              <label className="row" style={{ gap: 8 }}><input type="radio" name="kind" value="beach" /> Beach club, rooftop</label>
            </div>
          </fieldset>
        </ActionForm>
      </div>
    </main>
  );
}
