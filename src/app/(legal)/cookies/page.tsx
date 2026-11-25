import Link from "next/link";
import { MISE_A_JOUR } from "@/lib/legal";

export const metadata = { title: "Cookies · Tablo" };

/** Inventaire réel des cookies posés par le site (voir src/lib/session.ts, src/lib/look.ts, src/app/auth/google). */
const COOKIES = [
  ["tablo_session", "Vous garder connecté à l'espace club", "30 jours (1 heure pour la démo)"],
  ["tablo_look", "Garder vos réponses au questionnaire le temps de créer votre espace", "1 heure"],
  ["tablo_oauth_state", "Sécuriser la connexion avec Google", "10 minutes"],
  ["tablo_oauth_invite", "Rattacher une invitation d'équipe à la connexion avec Google", "10 minutes"],
];

export default function Page() {
  return (
    <>
      <span className="legal-eyebrow">Vos données</span>
      <h1>Cookies</h1>
      <p className="legal-maj">Dernière mise à jour : {MISE_A_JOUR}</p>

      <p>
        <strong>Tablo n&apos;utilise que des cookies indispensables au fonctionnement du service.</strong> Aucun cookie de
        publicité, de réseau social ou de mesure d&apos;audience n&apos;est déposé. Ces cookies indispensables sont exemptés de
        consentement (article 82 de la loi Informatique et Libertés, lignes directrices de la CNIL) : c&apos;est pourquoi le
        site ne vous affiche pas de bandeau.
      </p>

      <h2>Les cookies du site</h2>
      <div className="legal-table" role="table">
        <div role="row" className="head"><span>Nom</span><span>À quoi il sert</span><span>Durée</span></div>
        {COOKIES.map(([n, r, d]) => <div role="row" key={n}><span><code>{n}</code></span><span>{r}</span><span>{d}</span></div>)}
      </div>
      <p>Les pages de réservation des clubs (y compris dans le bouton posé sur leur site) ne déposent aucun cookie.</p>

      <h2>Services tiers</h2>
      <ul>
        <li><strong>Paiement</strong> : la page de paiement est hébergée par Stripe, qui y dépose ses propres cookies (sécurité, lutte contre la fraude), selon sa propre politique.</li>
        <li><strong>Site du club</strong> : quand vous réservez depuis le site d&apos;un club, ce site peut déposer ses propres cookies, sous sa responsabilité.</li>
        <li><strong>Polices de caractères</strong> : elles sont hébergées sur notre site ; aucune requête n&apos;est envoyée à Google Fonts.</li>
      </ul>

      <h2>Les supprimer</h2>
      <p>
        Vous pouvez supprimer les cookies depuis les réglages de votre navigateur. Supprimer <code>tablo_session</code> vous
        déconnecte de l&apos;espace club. Pour en savoir plus sur vos données : <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </>
  );
}
