import Link from "next/link";
import { EDITEUR, GARANTIE_JOURS, MISE_A_JOUR, PRIX_MENSUEL } from "@/lib/legal";
import T from "../T";

export const metadata = { title: "Conditions générales de vente · Tablo" };

/** CGV de l'abonnement des clubs (contrat entre professionnels). */
export default function Page() {
  return (
    <>
      <span className="legal-eyebrow">Pour les clubs</span>
      <h1>Conditions générales de vente</h1>
      <p className="legal-maj">Dernière mise à jour : {MISE_A_JOUR}</p>

      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent l&apos;abonnement au service Tablo souscrit par un établissement (club, discothèque,
        beach club, bar, ci-après « le Club ») auprès de <T v={EDITEUR.nom} />, {EDITEUR.statut.toLowerCase()} (ci-après « Tablo »).
        Elles s&apos;appliquent entre professionnels. En créant son espace puis en souscrivant, le Club les accepte.
      </p>

      <h2>2. Le service</h2>
      <p>Tablo met à disposition du Club, en ligne :</p>
      <ul>
        <li>une page et un bouton de réservation à intégrer à son site, son lien de bio ou un QR code, avec le plan de ses carrés ;</li>
        <li>la vente en ligne de carrés, bouteilles, shows et pancartes, avec acompte ou paiement complet ;</li>
        <li>les offres composées par ses managers, l&apos;espace club (soirée en direct, ventes, clients, statistiques), l&apos;app serveur et le contrôle à l&apos;entrée.</li>
      </ul>
      <p>Tablo peut faire évoluer le service pour l&apos;améliorer, sans en réduire les fonctions essentielles en cours d&apos;abonnement.</p>

      <h2>3. Compte</h2>
      <p>
        Le Club fournit des informations exactes et garde ses identifiants confidentiels. Il est responsable des membres
        de son équipe qu&apos;il invite et des droits qu&apos;il leur donne.
      </p>

      <h2>4. Prix et paiement</h2>
      <p>
        L&apos;abonnement coûte <strong>{PRIX_MENSUEL} par mois</strong> par établissement (<T v={EDITEUR.tva} />), sauf offre sur mesure
        acceptée par écrit. Il est payé d&apos;avance par carte, via Stripe, puis prélevé automatiquement chaque mois à la même date.
        Une facture est émise à chaque paiement.
      </p>
      <p>
        <strong>Tablo ne prend aucune commission</strong> sur les réservations du Club. Les frais du prestataire de paiement
        (Stripe) liés aux paiements des clients du Club sont à la charge du Club, selon les conditions de son compte Stripe.
      </p>

      <h2>5. Mise en ligne</h2>
      <p>
        Le Club configure son espace gratuitement. Ses réservations s&apos;ouvrent au public une fois l&apos;abonnement payé.
        En cas d&apos;échec de prélèvement non régularisé, Tablo peut fermer les nouvelles réservations jusqu&apos;au paiement ;
        les réservations déjà confirmées restent honorées par le Club.
      </p>

      <h2>6. Satisfait ou remboursé {GARANTIE_JOURS} jours</h2>
      <p>
        Si le service ne convient pas au Club, il peut demander le remboursement de son premier mois d&apos;abonnement
        dans les <strong>{GARANTIE_JOURS} jours</strong> qui suivent son premier paiement, sans avoir à se justifier,
        par email à <T v={EDITEUR.email} />. Le remboursement est fait sur le moyen de paiement utilisé, dans un délai de
        14 jours, et l&apos;abonnement prend fin. Cette garantie s&apos;applique une seule fois par établissement.
      </p>

      <h2>7. Durée et résiliation</h2>
      <p>
        L&apos;abonnement est <strong>sans engagement</strong> et se renouvelle chaque mois. Le Club le résilie à tout moment, en un clic,
        depuis son espace (page Abonnement). La résiliation prend effet à la fin du mois déjà payé ; ce mois n&apos;est pas remboursé,
        sauf application de la garantie de l&apos;article 6.
      </p>

      <h2>8. Paiements des clients du Club</h2>
      <p>
        Les acomptes et paiements des clients sont encaissés par Stripe directement sur le compte Stripe du Club, selon le
        contrat qui lie le Club à Stripe. Tablo n&apos;encaisse ni ne détient ces fonds. Les remboursements, annulations,
        contestations et impayés concernant ces paiements relèvent du Club.
      </p>

      <h2>9. Engagements du Club</h2>
      <ul>
        <li>Afficher des prix, minimums, acomptes et une politique d&apos;annulation exacts, et les respecter.</li>
        <li>Respecter les règles applicables à son activité, notamment la vente d&apos;alcool (licence, interdiction de vente aux mineurs, publicité encadrée par la loi Évin).</li>
        <li>Disposer des droits sur les logos, photos et textes qu&apos;il publie.</li>
        <li>Honorer les réservations confirmées et traiter lui-même les réclamations de ses clients.</li>
      </ul>

      <h2>10. Données personnelles</h2>
      <p>
        Pour les données de ses clients (réservations, coordonnées), le Club est responsable du traitement et Tablo agit
        comme sous-traitant, au sens de l&apos;article 28 du RGPD. Tablo s&apos;engage à :
      </p>
      <ul>
        <li>ne traiter ces données que pour fournir le service et sur les instructions du Club ;</li>
        <li>en assurer la confidentialité et la sécurité, et n&apos;y donner accès qu&apos;aux personnes qui en ont besoin ;</li>
        <li>ne recourir qu&apos;aux sous-traitants listés dans la <Link href="/confidentialite">politique de confidentialité</Link>, et informer le Club de tout changement ;</li>
        <li>aider le Club à répondre aux demandes de ses clients et lui signaler toute violation de données dans les meilleurs délais ;</li>
        <li>supprimer ou restituer ces données à la fin du contrat, à la demande du Club.</li>
      </ul>

      <h2>11. Disponibilité et responsabilité</h2>
      <p>
        Tablo met en œuvre les moyens raisonnables pour que le service soit disponible et sécurisé (obligation de moyens).
        Des interruptions de maintenance peuvent avoir lieu, de préférence en dehors des soirées. La responsabilité de Tablo
        est limitée aux dommages directs et plafonnée aux sommes payées par le Club sur les 12 derniers mois.
        Tablo n&apos;est pas partie aux ventes conclues entre le Club et ses clients.
      </p>

      <h2>12. Propriété intellectuelle</h2>
      <p>
        Tablo concède au Club, pendant l&apos;abonnement, un droit d&apos;utilisation du service. Le Club reste propriétaire de ses
        contenus et autorise Tablo à les afficher pour fournir le service.
      </p>

      <h2>13. Suspension</h2>
      <p>
        En cas de manquement grave (fraude, contenu illicite, atteinte à la sécurité), Tablo peut suspendre le compte après
        avoir prévenu le Club, sauf urgence.
      </p>

      <h2>14. Modification des conditions</h2>
      <p>
        Tablo peut modifier ces conditions. Le Club est prévenu par email au moins 30 jours avant l&apos;entrée en vigueur ;
        s&apos;il refuse, il peut résilier avant cette date.
      </p>

      <h2>15. Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. À défaut d&apos;accord amiable, tout litige relève des tribunaux de{" "}
        <T v={EDITEUR.tribunal} />.
      </p>
    </>
  );
}
