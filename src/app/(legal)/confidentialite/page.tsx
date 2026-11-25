import Link from "next/link";
import { EDITEUR, MISE_A_JOUR } from "@/lib/legal";
import T from "../T";

export const metadata = { title: "Politique de confidentialité · Tablo" };

const SOUS_TRAITANTS = [
  ["Vercel Inc.", "Hébergement du site", "États-Unis (garanties appropriées : cadre UE–États-Unis ou clauses contractuelles types)"],
  ["Supabase Inc.", "Base de données et photos", "Union européenne (Francfort, Allemagne)"],
  ["Stripe", "Paiements des clients et abonnement des clubs", "Union européenne (Irlande) ; transferts vers les États-Unis encadrés par le cadre UE–États-Unis"],
  ["Plus Five Five, Inc. (Resend)", "Envoi des emails (confirmations, invitations, relances)", "États-Unis (garanties appropriées : cadre UE–États-Unis ou clauses contractuelles types)"],
  ["Google", "Connexion avec Google, si vous la choisissez", "Union européenne et États-Unis"],
];

export default function Page() {
  return (
    <>
      <span className="legal-eyebrow">Vos données</span>
      <h1>Politique de confidentialité</h1>
      <p className="legal-maj">Dernière mise à jour : {MISE_A_JOUR}</p>

      <p>
        Cette politique explique quelles données sont traitées par Tablo, pourquoi, combien de temps, et comment exercer vos droits.
        Responsable de traitement pour les données des clubs et des visiteurs : <T v={EDITEUR.nom} />, <T v={EDITEUR.adresse} />,
        contact : <T v={EDITEUR.email} />.
      </p>

      <h2>1. Deux rôles différents</h2>
      <ul>
        <li><strong>Pour les clubs, leurs équipes et les visiteurs du site</strong>, Tablo décide de l&apos;usage des données : il est responsable de traitement.</li>
        <li><strong>Pour les clients qui réservent sur la page d&apos;un club</strong>, c&apos;est le club qui est responsable de traitement. Tablo traite ces données pour son compte, comme sous-traitant, et uniquement pour faire fonctionner la réservation. Pour exercer vos droits sur une réservation, adressez-vous au club ; nous l&apos;aiderons à vous répondre.</li>
      </ul>

      <h2>2. Les données traitées</h2>
      <h3>Clubs et équipes</h3>
      <ul>
        <li>Questionnaire d&apos;accueil : type de lieu, nom et ville de l&apos;établissement, nombre de carrés, façon de vendre, priorités.</li>
        <li>Compte : nom, email, mot de passe (enregistré chiffré, jamais lisible), ou identifiant Google si vous vous connectez avec Google.</li>
        <li>Configuration de l&apos;établissement : ambiance, plan, carrés, prix, bouteilles, shows, soirées, membres de l&apos;équipe.</li>
        <li>Abonnement : statut et factures. Les données de carte sont traitées par Stripe ; Tablo ne les voit pas.</li>
      </ul>
      <h3>Clients des clubs (pour le compte du club)</h3>
      <ul>
        <li>Nom, email, téléphone, soirée, carré, nombre de personnes, bouteilles et shows, montants, statut du paiement, QR code, commandes de la soirée, bouteille au garage.</li>
      </ul>
      <h3>Visiteurs</h3>
      <ul>
        <li>Données techniques de connexion (adresse IP, navigateur, pages demandées) conservées par l&apos;hébergeur pour la sécurité et le bon fonctionnement du site.</li>
        <li>Aucun outil de mesure d&apos;audience, aucune publicité, aucun réseau social n&apos;est installé sur le site.</li>
      </ul>

      <h2>3. Pourquoi, et sur quelle base</h2>
      <ul>
        <li><strong>Fournir le service</strong> (compte, configuration, réservations, paiements, emails) : exécution du contrat.</li>
        <li><strong>Accompagner un club inscrit</strong> (aide à la configuration, relance par email ou téléphone d&apos;un professionnel) : intérêt légitime ; vous pouvez vous y opposer à tout moment.</li>
        <li><strong>Sécuriser le site</strong> (limitation des tentatives de connexion, journaux techniques) : intérêt légitime.</li>
        <li><strong>Facturer et tenir la comptabilité</strong> : obligation légale.</li>
      </ul>

      <h2>4. Combien de temps</h2>
      <ul>
        <li>Compte et configuration d&apos;un club : pendant l&apos;abonnement, puis 3 ans après la fin de la relation, sauf demande de suppression.</li>
        <li>Inscription sans abonnement : 3 ans après le dernier contact.</li>
        <li>Factures : 10 ans (obligation comptable).</li>
        <li>Données des clients d&apos;un club : selon les instructions du club, et au plus tard supprimées à la fin du contrat du club.</li>
        <li>Cookies : voir la <Link href="/cookies">politique cookies</Link> (1 heure à 30 jours).</li>
      </ul>

      <h2>5. Qui y a accès</h2>
      <p>
        Seuls l&apos;éditeur et les membres autorisés de chaque club (selon leur rôle) accèdent aux données ; chaque club ne voit
        que les siennes. Les prestataires techniques suivants interviennent :
      </p>
      <div className="legal-table" role="table">
        <div role="row" className="head"><span>Prestataire</span><span>Rôle</span><span>Lieu des données</span></div>
        {SOUS_TRAITANTS.map(([n, r, l]) => <div role="row" key={n}><span>{n}</span><span>{r}</span><span>{l}</span></div>)}
      </div>
      <p>Aucune donnée n&apos;est vendue ni louée.</p>

      <h2>6. Sécurité</h2>
      <p>
        Connexion chiffrée (HTTPS), mots de passe hachés, données de chaque établissement cloisonnées, photos dans un espace
        de stockage privé, accès limités selon les rôles.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité,
        et du droit de définir des directives sur le sort de vos données après votre décès. Écrivez à <T v={EDITEUR.email} /> :
        nous répondons sous un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).
      </p>
    </>
  );
}
