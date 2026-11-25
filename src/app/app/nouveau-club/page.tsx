import Link from "next/link";
import { redirect } from "next/navigation";
import { createVenue } from "@/app/actions/club";
import { requireUser } from "@/lib/auth";
import { readLook } from "@/lib/look";
import { db } from "@/lib/db";
import ActionForm from "@/components/ActionForm";

export const metadata = { title: "Nouvel établissement · Tablo" };

export default async function Page() {
  const user = await requireUser();
  if (await db.membership.findFirst({ where: { userId: user.id } })) redirect("/app");
  const look = await readLook();
  const beach = look.kind === "beach";
  return (
    <main className="auth">
      <div className="card" style={{ width: "min(520px,100%)" }}>
        <Link href="/" className="logo"><i />tablo</Link>
        <h1 style={{ fontSize: 24 }}>Votre établissement</h1>
        <p className="mute" style={{ margin: 0, lineHeight: 1.6 }}>Bonjour {user.name}. On crée l&apos;espace de votre club : vous pourrez tout modifier ensuite.{look.amb ? " Votre ambiance et votre couleur sont déjà reprises." : ""}</p>
        <ActionForm action={createVenue} submit="Continuer la configuration">
          <label className="field">Nom de l&apos;établissement<input className="input" name="name" placeholder="Ex. Le Velours" defaultValue={look.club ?? ""} required /></label>
          <label className="field">Ville<input className="input" name="city" placeholder="Ex. Rouen" defaultValue={look.city ?? ""} /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 6 }}>Type de lieu</legend>
            <div className="row">
              <label className="row" style={{ gap: 8 }}><input type="radio" name="kind" value="club" defaultChecked={!beach} /> Club, discothèque</label>
              <label className="row" style={{ gap: 8 }}><input type="radio" name="kind" value="beach" defaultChecked={beach} /> Beach club, rooftop</label>
            </div>
          </fieldset>
        </ActionForm>
      </div>
    </main>
  );
}
