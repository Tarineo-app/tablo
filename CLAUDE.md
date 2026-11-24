# Tablo — contexte pour Claude Code

Tablo est le « Zenchef des carrés VIP » : un widget que les discothèques et beach clubs intègrent à leur site
(une ligne de script, un lien bio ou un QR code) pour vendre leurs tables VIP en ligne.
Abonnement mensuel pour le club (Club 79 €, Prestige 149 €), **aucune commission** sur les réservations :
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

## Hors MVP (ne pas construire maintenant)
Plan 3D (le MVP utilise un plan 2D), bouteilles 3D, shows générés par IA, détourage automatique,
fidélité et classement, objectifs par soirée, tarifs par soirée avancés, vues 360°.

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

À faire ensuite : **étape 4 (Stripe Connect : acompte et paiement complet)**, puis cagnotte `/c/[token]`, abonnement Stripe Billing,
emails Resend (invitations et confirmations), photos sur Supabase Storage (aujourd'hui en data URL).
Les réservations et les billets payants restent en « à payer » tant que Stripe n'est pas branché.

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

## Vue 3D du plan
`src/app/w/[slug]/Plan3D.tsx` : pas de bibliothèque 3D, uniquement du CSS 3D. La scène est `rotateX(planTilt) rotateZ(rot)`. Chaque carré est un cuboïde : la face du dessus est `translateZ(z)`, les quatre murs ont `transform-origin: 0 0` et `translateZ(z) rotateX(-90deg)` (plus `rotateY(-90deg)` pour les côtés). Les dimensions sont calculées en pixels depuis un ResizeObserver, pas en pourcentages, pour que les murs tombent juste. `TableCategory.color` et `elevation` pilotent la couleur et la hauteur, `VenueTable.photoUrl` la photo affichée à la sélection, `Venue.tour3dUrl` une vraie visite externe.

## Facturation
`src/lib/billing.ts` : `gateFor(venue, eventId)` décide si le public peut réserver. Elle est appelée dans le widget **et** dans `reserve.ts` / `tickets.ts` — ne jamais se contenter de griser un bouton. `closeTrialIfOver` passe le club en `LOCKED` le lendemain 8 h de sa soirée d'essai.

## Tunnel d'inscription
Les réglages pris sur la page d'accueil voyagent ainsi : URL `/inscription?club=…&site=…` → champs cachés `look_*` du formulaire (`AuthForm`) → cookie `tablo_look` posé **dans l'action `signup`** (jamais pendant le rendu d'une page) → `readLook()` dans `createVenue`.

## Démonstration sans compte
`/demo-club` (route handler) crée une session portant `demo: true` pour le propriétaire de l'établissement `isDemo`. Trois conditions : `DEMO_LOGIN=1`, l'établissement porte `isDemo`, et `requireMembership` renvoie vers `/connexion` si un jeton de démo tombe sur un autre établissement. La session dure 1 h. `refuseInDemo()` dans `src/lib/auth.ts` bloque les actions d'équipe, de compte et d'abonnement — **l'ajouter à toute nouvelle action qui envoie un email, engage de l'argent ou touche aux accès**. Le reste reste manipulable volontairement.
