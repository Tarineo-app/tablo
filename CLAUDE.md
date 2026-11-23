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
- Sessions maison (jose + bcrypt, cookie httpOnly, voir `src/lib/session.ts`) pour l'espace club ; Google pourra être ajouté plus tard. Les clients finaux réservent **sans compte** (email + téléphone).
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
Fait (étapes 0 à 3 de docs/PROMPTS.md) :
- Inscription, connexion, création de l'établissement (club ou beach club), garde `requireMembership()` dans `src/lib/auth.ts`.
- Espace club `/app` : tableau de bord avec la mise en route, ambiance et marque (6 ambiances + tout réglable, aperçu en direct),
  catégories (acompte %, shows inclus, minimum), éditeur de plan 2D (image + carrés déplaçables), bouteilles (3 formats, stock, goûts),
  shows et pancarte (catégories où ils peuvent être offerts), soirées, page Intégrer (script, lien, QR), liste des réservations.
- Widget public `/w/[slug]` : soirée → carré → bouteilles → pancarte et shows → coordonnées et mode de paiement → confirmation avec QR.
  Tous les montants sont recalculés côté serveur (`src/app/actions/reserve.ts`). Règle des shows offerts : `src/lib/pricing.ts`.
- `/embed.js` : bouton flottant + iframe, aux couleurs du club. Lien manager : `/w/[slug]?m=CODE`.
- Données de démo : `npm run db:seed` crée « Le Velours » (compte demo@tablo.club / tablo-demo).

À faire ensuite : étape 4 (Stripe Connect : acompte et paiement complet), puis 5 (cagnotte), 6 (managers), 7 (app serveur), 8 (abonnement).
Les réservations restent en statut DRAFT tant que le paiement n'est pas branché.
Images : pour l'instant logo et plan sont stockés en data URL (léger, compressé) ; passer à Supabase Storage avec l'étape des photos.
