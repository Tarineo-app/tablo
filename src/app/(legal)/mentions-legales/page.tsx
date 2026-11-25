import Link from "next/link";
import { EDITEUR, MISE_A_JOUR } from "@/lib/legal";
import T from "../T";

export const metadata = { title: "Mentions légales · Tablo" };

export default function Page() {
  return (
    <>
      <span className="legal-eyebrow">Informations légales</span>
      <h1>Mentions légales</h1>
      <p className="legal-maj">Dernière mise à jour : {MISE_A_JOUR}</p>

      <h2>Éditeur du site</h2>
      <p>
        Le site {EDITEUR.site} et le service Tablo sont édités par <T v={EDITEUR.nom} />, {EDITEUR.statut.toLowerCase()},
        exerçant sous le nom commercial « {EDITEUR.marque} ».
      </p>
      <ul>
        <li>Adresse : <T v={EDITEUR.adresse} /></li>
        <li>SIRET : <T v={EDITEUR.siret} /></li>
        <li>TVA : <T v={EDITEUR.tva} /></li>
        <li>Email : <T v={EDITEUR.email} /></li>
      </ul>
      <p>Directeur de la publication : <T v={EDITEUR.nom} />.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).
        La base de données est hébergée par Supabase Inc., sur des serveurs situés à Francfort (Allemagne).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque Tablo, le site, ses textes, son design, ses visuels et son code sont la propriété de l&apos;éditeur.
        Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite est interdite.
      </p>
      <p>
        Les noms, logos, photos, plans, prix et descriptions affichés dans les pages de réservation d&apos;un club
        appartiennent à ce club, qui en est seul responsable.
      </p>

      <h2>Responsabilité</h2>
      <p>
        L&apos;éditeur s&apos;efforce de fournir des informations exactes et un service disponible, sans pouvoir le garantir en permanence.
        Les réservations passées sur une page de club sont conclues entre le client et ce club : voir les{" "}
        <Link href="/cgu">conditions d&apos;utilisation</Link>.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Pour signaler un contenu illicite ou nous contacter : <T v={EDITEUR.email} />. Indiquez la page concernée
        et la raison de votre signalement.
      </p>

      <h2>Données personnelles et cookies</h2>
      <p>
        Voir la <Link href="/confidentialite">politique de confidentialité</Link> et la{" "}
        <Link href="/cookies">politique cookies</Link>.
      </p>
    </>
  );
}
