import Link from "next/link";
import { EDITEUR, MISE_A_JOUR } from "@/lib/legal";
import T from "../T";

export const metadata = { title: "Conditions d'utilisation · Tablo" };

/** Conditions d'utilisation pour les clients qui réservent sur la page d'un club, et pour les visiteurs du site. */
export default function Page() {
  return (
    <>
      <span className="legal-eyebrow">Pour les clients des clubs</span>
      <h1>Conditions d&apos;utilisation</h1>
      <p className="legal-maj">Dernière mise à jour : {MISE_A_JOUR}</p>

      <h2>1. Qui fait quoi</h2>
      <p>
        Tablo est un outil technique, édité par <T v={EDITEUR.nom} />, que les clubs utilisent pour vendre leurs carrés et
        emplacements VIP en ligne. Quand vous réservez sur la page d&apos;un club, <strong>vous contractez avec ce club</strong>, qui
        fixe ses prix, ses minimums, ses conditions d&apos;accès et sa politique d&apos;annulation, et qui exécute la prestation.
        Tablo n&apos;est pas partie à cette vente.
      </p>

      <h2>2. Âge et accès</h2>
      <p>
        La réservation est réservée aux personnes majeures. Le club peut demander une pièce d&apos;identité à l&apos;entrée et
        appliquer ses propres règles (tenue, horaires, refus d&apos;entrée) ; elles sont affichées sur sa page quand il les a renseignées.
      </p>
      <p>L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération.</p>

      <h2>3. La réservation</h2>
      <ul>
        <li>Vous choisissez la soirée, le nombre de personnes, votre carré sur le plan, puis vos bouteilles, shows et pancarte.</li>
        <li>Le total des bouteilles doit atteindre le minimum du carré affiché.</li>
        <li>Vous payez un acompte ou la totalité en ligne, selon ce que propose le club ; le reste éventuel se règle sur place.</li>
        <li>Pendant le paiement, le carré vous est réservé quelques minutes. Passé ce délai, il peut être proposé à quelqu&apos;un d&apos;autre ; si votre paiement arrive après, il est remboursé automatiquement.</li>
        <li>Une fois le paiement reçu, vous recevez une confirmation par email avec un QR code à présenter à l&apos;entrée.</li>
      </ul>

      <h2>4. Prix et paiement</h2>
      <p>
        Les prix sont fixés par le club et affichés toutes taxes comprises. Le paiement est traité par Stripe et versé
        directement au club ; Tablo ne voit ni ne conserve vos données de carte bancaire.
      </p>

      <h2>5. Annulation et remboursement</h2>
      <p>
        La politique d&apos;annulation est celle du club. Le droit de rétractation de 14 jours ne s&apos;applique pas aux prestations
        de loisirs fournies à une date déterminée (article L221-28, 12° du Code de la consommation). Pour toute demande
        d&apos;annulation, de modification ou de remboursement, contactez directement le club.
      </p>

      <h2>6. Offres des managers</h2>
      <p>
        Un manager du club peut vous envoyer une offre (carré, bouteilles, shows) à un prix qu&apos;il fixe. En l&apos;acceptant,
        vous réservez auprès du club aux conditions indiquées dans l&apos;offre.
      </p>

      <h2>7. Pendant la soirée</h2>
      <p>
        Depuis votre page de réservation, vous pouvez commander d&apos;autres bouteilles ou shows le soir même : la commande part
        au service du club et se règle à table. Le club peut aussi conserver une bouteille entamée (« garage ») selon ses
        propres conditions.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        Le club est responsable de l&apos;exécution de votre réservation et de l&apos;accueil. Tablo veille au bon fonctionnement
        de l&apos;outil, sans pouvoir garantir une disponibilité permanente.
      </p>

      <h2>9. Vos données</h2>
      <p>
        Vos coordonnées et votre réservation sont transmises au club, qui en est responsable ; Tablo les traite pour son compte.
        Voir la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>10. Contact</h2>
      <p>
        Pour une question sur votre réservation : le club. Pour une question sur l&apos;outil Tablo : <T v={EDITEUR.email} />.
      </p>
    </>
  );
}
