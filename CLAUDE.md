# Tablo — contexte pour Claude Code

Tablo est le « Zenchef des carrés VIP » : un widget que les discothèques et beach clubs intègrent à leur site
(une ligne de script, un lien bio ou un QR code) pour vendre leurs tables VIP en ligne.
Abonnement mensuel pour le club (**200 € par mois**, ou sur mesure pour les groupes), **aucune commission** sur les réservations :
l'argent des clients arrive sur le compte Stripe du club.

Le fondateur (Alann) n'est pas développeur : explique chaque étape simplement, en français,
et donne toujours la commande exacte à lancer.

## Références visuelles (à lire avant de coder une interface)
- `reference/demo-widget.html` : démo cliquable complète du parcours client et de l'espace club. C'est la cible UX.
- `public/landing.html` : la landing page, servie sur « / » (style noir, chrome, dégradé arc-en-ciel, polices Unbounded + Manrope).
- `docs/SPEC-MVP.md` : périmètre du MVP et règles métier. **Fait foi.**
- `docs/PROMPTS.md` : l'ordre de construction, étape par étape.

## Stack (identique à Tarineo)
- Next.js 16 (App Router) + TypeScript + Tailwind 4, déployé sur Vercel. Lire `AGENTS.md` : cette version de Next.js a des changements, sa documentation est dans `node_modules/next/dist/docs/`.
- PostgreSQL sur Supabase (région Frankfurt, RGPD) + Prisma. Supabase Storage pour les photos (bucket privé, chemins préfixés par `venueId`).
- Sessions maison (jose + bcrypt, cookie httpOnly, voir `src/lib/session.ts`) pour l'espace club, **plus OAuth Google maison** (`src/app/auth/google/`). Les clients finaux réservent **sans compte** (email + téléphone).
- Prisma **7** avec le générateur `prisma-client` (client généré dans `src/generated/prisma`, ignoré par git) et l'adaptateur `@prisma/adapter-pg`. Les URLs de connexion sont dans `prisma.config.ts`, plus dans `schema.prisma`.
- Stripe :
  - **Stripe Billing** pour l'abonnement du club à Tablo.
  - **Stripe Connect (comptes Express)** pour les paiements des clients, versés directement au club.
- Resend pour les emails. Supabase Realtime pour l'app serveur (envois en direct).

## Architecture
- Multi-établissement : **chaque table métier porte `venueId`**. Toute requête filtre par `venueId` du membre connecté.
- Rôles par établissement (`Membership.role`) : `OWNER`, `DIRECTOR`, `MANAGER` (commercial), `SERVER`, `BARMAN`.
- Widget public : `/w/[venueSlug]` (page plein écran, responsive) + `/embed.js` qui injecte un bouton flottant
  et ouvre `/w/[venueSlug]` dans une iframe. Lien manager : `/w/[venueSlug]?m=<code>`.
- Espace club : `/app/...` (connecté). App serveur : `/app/service` (mobile d'abord).
- Cagnotte : page publique `/c/[token]`.

## Règles de code
- Montants en **centimes (Int)**, jamais en float. Devise EUR. Fuseau `Europe/Paris`.
- Aucune marque de bouteille codée en dur : tout vient de la base (le club crée ses bouteilles).
- Initialisation Stripe **paresseuse** (jamais au chargement du module) pour ne pas casser le build si une clé manque.
- Webhooks Stripe = source de vérité pour les statuts de paiement. Vérifier la signature.
- `vercel-build` lance `prisma migrate deploy` avant `next build`.
- Valider toutes les entrées avec zod. Pas de secret dans le code ni dans le chat : `.env.local` uniquement.
- Mention obligatoire sur les pages qui montrent de l'alcool : « L'abus d'alcool est dangereux pour la santé, à consommer avec modération. »
- Pas de faux avis ni de faux témoignages.

## Pièges déjà rencontrés sur Tarineo
- Ne pas mettre le projet dans un dossier synchronisé iCloud (Bureau, Documents) : utiliser `~/dev/tablo`.
- Cache Turbopack corrompu → supprimer `.next` et relancer.
- Tests sur mobile en réseau local → `allowedDevOrigins` dans `next.config`.

## Hors périmètre (décidé le 24/11/2026)
- **La cagnotte** (paiement à plusieurs) sort du produit : trop de construction pour le départ.
  L'enum `PayMode.POOL` et les colonnes `poolToken`/`poolDeadline` restent en base, dormantes.
- **La billetterie** est fermée par défaut (`Venue.ticketsEnabled`). Shotgun sert déjà l'entrée simple ;
  le cœur du produit, c'est le carré. Le code reste entier, un interrupteur suffit à la rouvrir.
- Toujours hors sujet : bouteilles 3D, shows générés par IA, détourage automatique, fidélité et classement,
  objectifs par soirée, vues 360°.

## Où en est le code

Fait :
- **Comptes et équipe** : inscription, connexion email/mot de passe, **connexion Google** (`/auth/google`, actif seulement si `GOOGLE_CLIENT_ID` est défini),
  garde `requireMembership(roles?)` dans `src/lib/auth.ts`. Page Équipe : invitation par **lien signé** (JWT 7 jours, `src/lib/invite.ts`, aucune table),
  changement de rôle, commission du manager, retrait. Page publique `/invitation/[token]`.
  Rôles appliqués partout : la configuration est réservée à OWNER/DIRECTOR, le manager voit ses ventes et son lien, serveur et barman vont sur `/app/service`.
- **Espace club rangé par métier** (`src/components/SideNav.tsx`) :
  - `/app` **Ce soir** : plan de la soirée en direct (libre / réservé / arrivé / absent), panneau latéral par carré, marquer arrivé ou absent,
    **installer un client sans réservation** en deux clics (`src/app/actions/floor.ts`). Rafraîchissement automatique.
  - `/app/ventes` : carrés et entrées, onglets, totaux. (`/app/reservations` redirige ici.)
  - `/app/clients` : fichier clients **déduit des ventes** (`src/lib/clients.ts`), aucune saisie : venues, dépensé, bouteilles préférées, manager, occasions.
  - `/app/stats` : CA par soirée, remplissage, panier moyen, ventes par manager, entrées par tarif, taux d'absence, délai de réservation.
  - `/app/service` : envois de la soirée, « Je prends » / « Servi », rafraîchissement automatique, mobile d'abord.
  - `/app/entree` : contrôle à la porte, scan QR (BarcodeDetector) ou code tapé, marche pour les billets **et** les carrés.
  - Réglages : ambiance, catégories, plan 2D, bouteilles, shows, soirées et billetterie, intégration, informations du club (`/app/reglages`).
- **Widget public** `/w/[slug]` : soirée → carré → bouteilles → pancarte et shows → coordonnées et paiement → confirmation avec QR.
  Montants recalculés côté serveur (`src/app/actions/reserve.ts`), shows offerts dans `src/lib/pricing.ts`.
- **Options liées aux bouteilles** (« couronne de 3 Moët ») : un `Show` avec `minBottles > 0` (et `bottleId` facultatif)
  apparaît **à l'étape des bouteilles** et se débloque au nombre de bouteilles commandées (`bottleOptionUnlocked` dans `src/lib/pricing.ts`).
  Il suit les mêmes règles d'offert que les autres shows, et n'apparaît plus à l'étape 3.
- **Garage** : bouteille entamée gardée au club (`GarageItem`, code à 6 caractères donné au client).
  Réglages sur `/app/garage` : activé ou non, bouteilles à racheter, durée, et si le minimum du carré s'applique quand même.
  Côté client, bloc dans l'étape des bouteilles ; la bouteille part dans l'envoi n°1 avec `OrderItem.fromGarage`.
- **Revente des billets** : donner son billet à un proche (nouveau code, l'ancien passe en `TRANSFERRED`)
  ou le rendre au club s'il l'accepte (`RETURNED`, place remise en vente, remboursement listé dans `/app/ventes`).
  Réglages sur `/app/soirees`.
- **Billetterie** `/w/[slug]/billets` : tarifs par soirée avec **heure limite d'arrivée** et consos incluses (`src/lib/tickets.ts`, `src/app/actions/tickets.ts`),
  quota par tarif, billet `/w/[slug]/b/[token]` avec QR et code à 8 caractères. Côté club : `/app/soirees/[id]`.
- `/embed.js` : panneau latéral (ou fenêtre avec `data-mode="modal"`), `data-page="billets"`, `data-tablo-open="billets"`, aux couleurs du club.
- **Landing** `public/landing.html` servie sur « / » (version 3, courte et tournée vers la conversion) :
  promesse + un seul appel à l'action, démo jouable dans le haut de page (iframe `public/demo.html?embed=1`)
  avec visite guidée en 5 chapitres pilotée par `postMessage` (`tour(n)` dans demo.html) et changement d'ambiance en direct,
  trois bénéfices, maquette de l'espace club en 3 onglets, tarifs avec calcul rapide, FAQ, appel final.
  **Règle : ne pas la ré-alourdir.** Toute nouvelle fonction entre dans la bande « aussi inclus » ou dans la FAQ, pas dans une section de plus.
- Données de démo : `npm run db:seed` crée « Le Velours » (demo@tablo.club / tablo-demo) avec 4 tarifs d'entrée par soirée.

Branché le 25/11/2026 (voir « Paiements, abonnement, emails, photos » plus bas) : Stripe Connect, Stripe Billing, emails Resend,
relances du matin, photos sur Supabase Storage. **Tout s'active avec des variables d'environnement** (`.env.example`) :
sans clé, le site marche comme avant (réservations « à payer », liens à copier, photos en base).
Reste : billets payants en ligne (la billetterie est fermée par défaut), CGV et mentions légales, Stripe en production.

### Sécurité (audit du 23/11/2026, voir le doc « Tablo — audit de sécurité » du projet)
- Les cookies de session portent `purpose: "session"` ; `readSession()` refuse tout autre jeton signé avec `SESSION_SECRET`
  (sinon un lien d'invitation pouvait servir de session). **Tout nouveau jeton signé avec cette clé doit porter son propre `purpose`.**
- `src/lib/ratelimit.ts` : limiteur en mémoire sur la connexion, l'inscription, la réservation, l'achat de billets et la porte.
  À remplacer par un compteur partagé quand le trafic montera.
- En-têtes dans `next.config.ts` : `frame-ancestors 'none'` partout **sauf** `/w/*` (le widget vit dans l'iframe des clubs) et la démo.
- `package.json` contient un `overrides` sur `effect` (vulnérabilité ReDoS tirée par l'outil Prisma). `npm audit` doit rester à 0.
- Toute requête métier doit filtrer par `venue.id` après `requireMembership()`. Toute mise à jour par identifiant
  doit être précédée d'une lecture filtrée, ou utiliser `updateMany`/`deleteMany` avec `venueId`.

### Migrations
- `20261123115825_init`
- `20261123130000_billetterie` (TicketTier, Ticket, enum TicketStatus)
- `20261123160000_garage_et_couronnes` (GarageItem, Show.minBottles/bottleId, réglages garage sur Venue, OrderItem.fromGarage)
- `20261123170000_revente_billets` (TicketStatus TRANSFERRED/RETURNED, réglages de revente sur Venue, Ticket.fromTicketId)

À appliquer avec `npx prisma migrate deploy`.

## Plan des carrés (3D et vue de dessus)
`src/app/w/[slug]/Plan3D.tsx` (+ `.p3-*` dans `src/app/w/widget.css`), utilisé **toujours** par le widget : `Venue.plan3d` ne décide plus que la vue d'ouverture (3D ou vue de dessus).
Pas de bibliothèque 3D, uniquement du CSS 3D. La scène est `rotateX(planTilt) rotateZ(rot)` ; les positions sont en % **du sol** (`.p3-stage`, mesuré par ResizeObserver), pas du cadre.
Chaque emplacement reçoit son **mobilier** (`src/lib/furniture.ts`, partagé serveur/navigateur) : `TableCategory.furniture` choisi par le club dans Catégories
(`carre` banquette en U et table lumineuse, `haute` table haute et tabourets, `cabana` toile et poteaux, `bali` lit balinais et parasol), sinon deviné d'après le nom (`kindOf`).
`Venue.kind === "beach"` passe en bois, sable et toile ; le club le choisit dans l'éditeur de plan (Décor), avec la couleur du sol (`wallColor`).
**Le même composant sert partout** : widget client, « Ce soir » (`staff` : tous les carrés cliquables, couleur selon l'état libre/réservé/arrivé/absent, vue de dessus par défaut),
onglet « Aperçu client » de l'éditeur de plan, et aperçu de la page Ambiance. Hors du widget, importer `@/app/w/widget.css` et envelopper dans `themeVars(theme)`.
Les étiquettes (nom, prix) **ne sont pas dans la scène 3D** : `project()` calcule leur place à l'écran avec le même calcul que le navigateur
(rotateX/rotateZ autour du centre du sol, perspective 1400 depuis 50 % 40 % du cadre) et elles sont dessinées dans le calque `.p3-labels`. Le mobilier ne peut donc jamais les cacher.
Si on change la perspective, l'origine ou l'ordre des rotations en CSS, **changer `project()` en même temps**. L'inclinaison s'anime en JS (pas de transition CSS sur `.p3-stage`) pour que les étiquettes suivent.
**Grands plans** : zoom (boutons + / −, pincement, Ctrl + molette) et déplacement en glissant ; le zoom agrandit vraiment le sol, donc les étiquettes gardent leur taille.
Un carré trop étroit (`fullMin`) n'affiche qu'une pastille courte (`shortName` : « Lounge 12 » → « L12 ») ; l'étiquette complète revient au survol, à la sélection ou en zoomant. Un carré choisi en zoom est recentré.
Sous le plan, `.w-cats` : chaque catégorie avec sa couleur, son prix de départ et le nombre de carrés libres.
Pièges : **jamais de `filter` ni d'`opacity` sur un élément qui porte du 3D** (le navigateur l'aplatit ; on grise les enfants) ; en vue de dessus, les murs et pieds (vus de profil) sont retirés, sinon le tri des plans se trompe.
`TableCategory.color` et `elevation` pilotent la couleur et la hauteur, `VenueTable.photoUrl` la photo affichée à la sélection, `Venue.tour3dUrl` une vraie visite externe.
La démo (`public/demo.html`, `stepCarre`) suit le même principe avec son propre décor (piste LED, cabine DJ et bar en relief, mer, piscine, palmiers).

## Widget responsive (25/11/2026)
`src/app/w/widget.css`, bloc « Mise en page responsive ». Règle : **le bouton « Continuer » est toujours à l'écran** (barre `.w-nav` collée en bas sur ordinateur, `.w-foot` fixe sur mobile).
Le plan ne dépasse jamais `min(56vh, 540px)` sur ordinateur. Sur mobile (≤ 900 px) : bouteilles en lignes compactes (zones `ph nm sz add fl`), infos du carré sur 4 colonnes,
légende des catégories qui défile à l'horizontale, et le récapitulatif (`.w-aside`) devient un **tiroir** ouvert par le total en bas (`cartOpen`, pastille du nombre d'articles).
La mention loi Évin est répétée en bas de page sur mobile (`.w-legal-m`) puisque le panneau de droite y est masqué. Tester sur 360×640, 390×844, 820×1180 et 1366×800.

## Ambiance et couleurs (25/11/2026)
`src/lib/theme.ts`. Six ambiances : Tablo, **Noir et or**, **Velours rouge** (fond `velours` bordeaux), Disco, Pool party, Chic clair
(« Bal masqué » et « Jungle » retirées, aussi dans `public/demo.html` et le constructeur de la landing ; un ancien thème `jungle` retombe sur le fond noir).
**Couleurs partie par partie** : `Theme.colors` (`COLOR_PARTS` : titres, fond, cartes, texte, boutons, 2ᵉ couleur des boutons = dégradé, bouton sur le site).
Une partie absente suit l'ambiance ; `themeVars()` recalcule les nuances voisines (bordures, textes secondaires) avec `mixHex`. Variables ajoutées : `--w-title`, `--w-fab`, `--w-fab-on`
(le bouton flottant d'`embed.js` lit `--w-fab` via `/embed.js/theme`). `saveTheme` ne garde que les parties connues en `#rrggbb`. Choisir une ambiance remet les couleurs en auto.

## Facturation (25/11/2026 : plus de soirée offerte)
Décision d'Alann : **le club paie pour s'investir**. Plus de soirée d'essai gratuite : il configure tout, puis s'abonne (200 €/mois) pour ouvrir ses réservations,
avec **« Satisfait ou remboursé 30 jours »** (premier mois remboursé sans question ; durée dans `GARANTIE_JOURS` de `src/app/app/configuration/Setup.tsx`,
à reporter dans les CGV). Remboursement à faire à la main dans Stripe. Landing, page Abonnement et bannière de l'espace club le disent.
`src/lib/billing.ts` : `gateFor(venue, eventId)` décide si le public peut réserver (`SETUP` = fermé, `ACTIVE` = ouvert ; `TRIAL`/`LOCKED` ne servent plus qu'aux anciens clubs).
Elle est appelée dans le widget **et** dans `reserve.ts` / `tickets.ts` — ne jamais se contenter de griser un bouton. L'action `pickTrialEvent` est **supprimée** (elle était publique).

## Tunnel d'inscription : questions d'abord, identifiants à la fin
1. **`/inscription`** (`src/app/(auth)/inscription/Onboarding.tsx`) : 5 questions, une par écran (type de lieu, nom et ville, nombre de carrés,
   comment il vend aujourd'hui, ses priorités), puis **« Votre plan »** construit d'après ses réponses (chaque ligne = une vraie fonction, rien d'inventé),
   et seulement ensuite le compte (email ou Google via `googleWithLook`, qui garde les réponses dans le cookie le temps de l'aller-retour).
   Les réglages de la page d'accueil (`/inscription?club=…&kind=…&amb=…`) préremplissent les réponses.
2. **`signup`** crée l'utilisateur **et son établissement d'un coup** (`createVenueFor` dans `src/lib/venue-create.ts`, fonction serveur ordinaire, pas une action),
   avec ses réponses dans `Venue.onboarding` (`{ size, sell[], goals[], done[] }` : à lire avant d'appeler un club), puis envoie vers la configuration.
   Sans réponses complètes (ou par Google), il passe par `/app/nouveau-club`, prérempli.
3. **`/app/configuration`** (`Setup.tsx`, actions dans `src/app/actions/setup.ts`) : ambiance → carrés et prix (`autoPlan` dessine le plan tout seul s'il n'y a encore aucun carré)
   → bouteilles → shows (suggestions cochables, `addSetupShows`) → première soirée → encaissement Stripe (ou « plus tard ») → **mise en ligne : paiement 200 €, satisfait ou remboursé**.
   La progression se lit en base (carrés, bouteilles, shows, soirées) ; ambiance et « paiements plus tard » sont notés dans `onboarding.done` (`markSetup`).
Le cookie `tablo_look` n'est posé que dans une action (`signup`, `googleWithLook`), jamais pendant le rendu d'une page.

## Carrés tenus hors application
`blockTable` / `releaseTable` dans `src/app/actions/floor.ts`, formulaire sur `/app/soirees/[id]`.
Un carré promis au téléphone, en DM ou au comptoir est bloqué en amont : une `Reservation` `CONFIRMED`
sans email (c'est ce qui la distingue d'une vraie réservation en ligne), ce qui la sort du widget.
`releaseTable` la passe en `CANCELLED` et le carré repart à la vente.

## Démonstration sans compte
`/demo-club` (route handler) crée une session portant `demo: true` pour le propriétaire de l'établissement `isDemo`. Trois conditions : `DEMO_LOGIN=1`, l'établissement porte `isDemo`, et `requireMembership` renvoie vers `/connexion` si un jeton de démo tombe sur un autre établissement. La session dure 1 h.
En ligne (https://tablo-club.vercel.app, projet Vercel `tablo-club`, équipe Tarineo-Team), `vercel-build` lance le seed quand `DEMO_LOGIN=1` : il crée « Le Velours » une seule fois (mot de passe aléatoire hors base locale, on entre par `/demo-club`) et recrée des soirées dès qu'il n'en reste plus à venir. `refuseInDemo()` dans `src/lib/auth.ts` bloque les actions d'équipe, de compte et d'abonnement — **l'ajouter à toute nouvelle action qui envoie un email, engage de l'argent ou touche aux accès**. Le reste reste manipulable volontairement.

## Offres du manager (le cœur commercial)
`src/lib/offers.ts`, `src/app/actions/offers.ts`, `/app/offres`, page publique `/o/[code]`.
Le manager compose la soirée d'un client (carré, bouteilles, shows, pancarte), coche ce qui est **offert**,
fixe **son** prix (`Offer.priceCents`) pendant que `listCents` garde la valeur à la carte. L'écart entre les
deux est ce qu'il offre, et c'est ce qu'on montre au client. À l'acceptation, la réservation est créée au prix
du manager, les lignes offertes à 0 €, l'envoi n°1 monté avec les bouteilles.
Sens inverse : `requestOffer` (widget) et `askManager` (page de réservation) créent une offre `REQUESTED`
que le manager chiffre ensuite. **Les prix sont toujours relus en base, jamais pris du navigateur.**

Principe à ne pas perdre de vue : l'outil ne doit jamais court-circuiter le manager. C'est son argument
de vente, pas son remplaçant.

## Recommander en soirée
`src/app/actions/reorder.ts`. Depuis `/w/[slug]/r/[token]`, le client ajoute bouteilles et shows :
un nouvel `Order` numéroté à la suite part au service. `OrderItem.bottleSizeId` est désormais
**nullable** et `showId` existe — tout affichage d'un article passe par `itemLabel()` (`src/lib/orderitem.ts`).
La fenêtre est la nuit même : de la veille au lendemain midi.

## Landing (version 5, 25/11/2026 soir)
**Plus de défilement bloqué.** Accroche centrée (`.hero`, bouton principal + « Essayer la démo »), puis **la démo au centre** (`#demo`) :
3 onglets (`.showtabs` : le client réserve / le manager propose / le club pilote), le téléphone au milieu, 4 légendes autour (`CALLS` dans le script, 2 à gauche, 2 à droite),
puis un bouton vers le questionnaire. Écrans du téléphone : le site du club avec l'en-tête animé en canvas (`#pVid`) et le bouton « Réserver une table » qui ouvre la vraie réservation
(`demo.html?embed=1` dans `#pFrame`, `tryIt()`, croix `#pClose`) ; le WhatsApp du manager (`.pchat`, classe `chat`) ; l'app serveur (`.pserv`, classe `serv`).
Ensuite : 3 bénéfices (`#benefices`) + bande « aussi inclus » (`.strip`), l'espace club en fenêtre (`#club`), la FAQ, l'appel final.
**Tous les boutons principaux mènent au questionnaire `/inscription`** ; la démo de l'espace club est un bouton secondaire. Constructeur supprimé.
**Lien personnalisé pour la prospection** : `/?club=Le%20Rex&site=lerex.fr` met le nom du club et sa vraie page dans le téléphone (via `/api/apercu`) et préremplit le questionnaire.
**DA du tunnel** : questionnaire, connexion, création du club et configuration reprennent la landing à l'identique (bloc « Tunnel de vente » en fin de `globals.css`). Ne pas s'en écarter.
Règle : ne pas ré-alourdir ; une nouvelle fonction va dans la bande `.strip` ou la FAQ.

### Migrations (suite)
- `20261123180000_vue_3d`, `20261123190000_essai_par_soiree`, `20261123200000_demo`
- `20261124200000_offres_manager` (Offer, OfferItem, OrderItem.showId, ticketsEnabled, payModes sans POOL)
- `20261125220000_mobilier` (TableCategory.furniture)
- `20261125230000_questionnaire` (Venue.onboarding)
- `20261125160000_paiements` (Venue : état du compte Stripe, abonnement, `trialReportSentAt` ; Reservation : `holdUntil`, `stripeSessionId`, `stripePaymentIntentId`, `paidAt`)

## Paiements, abonnement, emails, photos (25/11/2026)
- **Paiement des clients** : `src/lib/stripe.ts` (client paresseux, `paymentsReady(venue)`), `src/lib/checkout.ts`, route `POST /w/[slug]/r/[token]/payer`.
  Stripe Checkout en **direct charge sur le compte connecté du club** (`stripeContext`), aucune commission. Compte créé avec `controller`
  (tableau de bord Stripe complet, frais payés par le club, pertes couvertes par Stripe) : Stripe **refuse `type: "express"`** avec le modèle choisi sur la plateforme. Le montant payé est `depositCents`.
  Quand le club peut encaisser, la réservation naît en `PENDING_PAYMENT` avec `holdUntil` : **5 min** en réservation directe, **30 min** pour une offre de manager
  (`HOLD_MINUTES` dans `src/lib/stripe.ts`). La page Stripe reste ouverte 30 min (minimum Stripe) : un paiement arrivé après reprise du carré est remboursé par le webhook.
  **Toute vérification « carré libre » passe par `occupying()` (`src/lib/holds.ts`)** : un `PENDING_PAYMENT` dont le délai est passé ne tient plus le carré.
- **Webhook** `POST /api/stripe/webhook`, deux secrets (`STRIPE_WEBHOOK_SECRET` plateforme, `STRIPE_CONNECT_WEBHOOK_SECRET` comptes connectés),
  logique dans `src/lib/stripe-events.ts` : paiement reçu → `CONFIRMED`/`FULLY_PAID` + email ; doublon → remboursé ; carré pris entre-temps → annulé, remboursé, garage libéré ;
  session expirée → `CANCELLED` ; `account.updated` → `stripeChargesEnabled` ; abonnement → `billing` ACTIVE/LOCKED.
  Un événement de réservation doit venir du compte du club (`event.account === venue.stripeAccountId`) ; un abonnement, jamais d'un compte connecté.
- **Espace club** : `/app/paiements` (activer le compte Stripe du club, lien vers son tableau de bord Stripe), `/app/abonnement` (Checkout abonnement 200 €/mois, portail Stripe).
  Actions dans `src/app/actions/stripe.ts`, toutes derrière `refuseInDemo()`. Les relectures Stripe au retour sont dans `src/lib/stripe-sync.ts` (pas des server actions).
- **Recommande en soirée** : se règle à table (`Order.cashDueCents`), quel que soit le mode de la réservation.
- **Emails** : `src/lib/email.ts` (API Resend en HTTP, gabarit `layout()`), `src/lib/notify.ts` : confirmation de réservation, remboursement,
  demande d'offre (au manager), offre au client (bouton « Par email » sur `/app/offres`), invitations d'équipe.
- **Relances du matin** : `GET /api/cron/daily` (Vercel Cron, `vercel.json`, protégé par `CRON_SECRET`) : ferme les soirées test terminées,
  envoie le bilan (une seule fois, `trialReportSentAt`), « placez vos carrés » à J+1, « soirée test » à J-2.
- **Photos** : `src/lib/storage.ts`. Bouteilles et shows : champ fichier `photo` (`imageFromForm`), ou une adresse https. À l'enregistrement du plan et du logo, les images `data:` partent dans le bucket privé `tablo`
  (`venueId/sha256.ext`) et la base garde `/media/…`, servi par `src/app/media/[...path]/route.ts` (cache immuable, SVG en bac à sable).
- **Démo** (`public/demo.html`) : plus aucune marque ni photo de bouteille (127 Ko au lieu de 2,4 Mo).
- **Stripe (test)** : compte « Tablo », environnement de test `acct_1UfMaXLiMqi0CTao`. Webhooks `tablo-abonnements` (compte) et `tablo-paiements-clubs` (comptes connectés) vers `/api/stripe/webhook`, tous deux vérifiés le 25/11/2026 (200 OK).
