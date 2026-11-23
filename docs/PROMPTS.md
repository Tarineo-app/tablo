# Tablo — construire le MVP avec Claude Code, étape par étape

> **État : les étapes 0 à 3 sont faites** (voir « Où en est le code » dans CLAUDE.md). Reprendre à l'étape 4.

Une étape = une session Claude Code. Copie le prompt, laisse Claude Code travailler, teste ce qui est demandé dans
« Vérifier », puis fais un commit avant de passer à la suivante. Ne saute pas d'étape.

---

## Étape 0 — Créer le projet

Dans le Terminal (hors iCloud) :
```
mkdir -p ~/dev && cd ~/dev
```
Décompresse le kit dans `~/dev/tablo`, puis :
```
cd ~/dev/tablo && claude
```

**Prompt :**
> Lis CLAUDE.md, docs/SPEC-MVP.md et prisma/schema.prisma. Crée le projet Next.js (App Router, TypeScript, Tailwind, ESLint) dans ce dossier sans écraser ces fichiers. Installe Prisma (garde la version de Prisma compatible avec `url`/`directUrl` dans le schéma, ou adapte avec prisma.config.ts si c'est Prisma 7), zod, Auth.js. Prépare `.env.example` avec toutes les variables nécessaires (Supabase, Auth.js, Stripe, Resend). Ajoute le script `vercel-build`. Initialise git avec un `.gitignore` qui exclut `.env*`. Explique-moi ensuite comment créer le projet Supabase (région Frankfurt) et remplir `.env.local`.

**Vérifier :** `npm run dev` affiche la page d'accueil ; `npx prisma migrate dev --name init` crée les tables dans Supabase.

---

## Étape 1 — Comptes, établissement, équipe

> Mets en place l'authentification de l'espace club (email + mot de passe, Google en option) avec Auth.js. Après inscription, l'utilisateur crée son établissement (nom, ville, type club ou beach, slug unique) et devient OWNER. Crée la page Équipe : inviter par email avec un rôle (DIRECTOR, MANAGER, SERVER, BARMAN), email via Resend. Toutes les requêtes doivent être filtrées par le venueId du membre connecté, avec un helper unique `requireMembership(roles)`.

**Vérifier :** deux comptes, deux clubs : aucun ne voit les données de l'autre.

---

## Étape 2 — Configuration du club

> Construis l'onboarding de l'espace club en étapes, comme dans reference/demo-widget.html (bouton « Espace club ») : identité (logo, couleur, fond, police), catégories de carré (nom, % d'acompte, shows inclus, minimum), plan 2D (import d'une image puis placement des carrés en glisser-déposer, positions en %), bouteilles (photo, formats et prix, goûts, stock), pancarte (photo de la pancarte du club), shows (nom, prix, photo ou vidéo d'aperçu, catégories éligibles), soirées (dates ouvertes, minimum par carré pour une soirée). Photos dans Supabase Storage, bucket privé, chemins préfixés par venueId.

**Vérifier :** configurer entièrement un club fictif « Le Velours » avec 6 carrés et 5 bouteilles.

---

## Étape 3 — Le widget client

> Construis le widget public `/w/[venueSlug]` en reprenant le parcours et le style de reference/demo-widget.html, avec le thème du club : soirée et groupe → plan 2D → bouteilles (minimum obligatoire) → pancarte et shows (inclus puis payants) → récapitulatif. Récapitulatif toujours visible (panneau à droite sur ordinateur, barre en bas sur mobile). Pas encore de paiement : la réservation est créée en DRAFT. Crée aussi `/embed.js` (bouton flottant qui ouvre le widget en iframe) et la page « Intégrer » de l'espace club avec le code à copier, le lien bio et un QR code.

**Vérifier :** coller le script sur une page HTML vide et faire une réservation de bout en bout sur iPhone.

---

## Étape 4 — Paiements (Stripe Connect)

> Intègre Stripe Connect Express : dans l'espace club, bouton « Activer les paiements » (onboarding Stripe, puis retour). Dans le widget, paiement complet et acompte selon la catégorie (`ceil(total × depositPct / 100)`), avec Stripe Payment Element (CB, Apple Pay, Google Pay), en direct charge sur le compte du club. Mode espèces : acompte en ligne, reste sur place. Webhook Stripe = source de vérité des statuts (PENDING_PAYMENT → CONFIRMED / FULLY_PAID). Initialisation Stripe paresseuse. Email de confirmation avec QR code. Tout en mode test.

**Vérifier :** paiement avec la carte de test 4242 ; la réservation passe en CONFIRMED ; l'argent apparaît sur le compte connecté de test.

---

## Étape 5 — La cagnotte

> Construis la cagnotte selon docs/SPEC-MVP.md : l'organisateur paie au moins l'acompte et enregistre sa carte (setup_future_usage off_session), reçoit le lien `/c/[token]`. Page publique de cagnotte : progression, participants, paiement d'un montant libre (minimum 5 €, maximum le reste). Tâche planifiée (Vercel Cron) : rappels J-2 et J-1, puis à l'échéance débit du reste sur la carte de l'organisateur ; en cas d'échec, statut PAYMENT_ISSUE et alerte au club.

**Vérifier :** cagnotte à 3 participants en test ; déclencher l'échéance à la main et voir le débit du reste.

---

## Étape 6 — Managers commerciaux

> Chaque MANAGER a un code de lien `/w/[slug]?m=code`. Les réservations faites via ce lien lui sont attribuées. Page « Mes clients » pour le manager (ses réservations, total vendu, commission calculée avec le % fixé par le directeur). Le manager peut aussi créer une réservation pour un client depuis l'espace club et lui envoyer le lien de paiement.

**Vérifier :** une réservation via le lien d'un manager apparaît chez lui et pas chez les autres managers.

---

## Étape 7 — Soirée et app serveur

> Page « Ce soir » pour le directeur : plan en direct (carrés libres, réservés, arrivés), check-in par scan du QR. App serveur mobile `/app/service` : onglets Mes carrés / Tous / Bar, chaque envoi (n°1 = commande initiale, n°2, n°3…), boutons « Je prends » puis « Servi », espèces à encaisser. Temps réel avec Supabase Realtime. Le client peut commander un envoi n°2 depuis son lien de réservation.

**Vérifier :** deux téléphones : un envoi commandé apparaît en direct chez le serveur.

---

## Étape 8 — Abonnement Tablo et landing

> Ajoute l'abonnement du club à Tablo avec Stripe Billing (Club 79 €, Prestige 149 € par mois, essai gratuit de 30 jours, résiliation à la fin de période), comme sur Tarineo. Intègre la landing page de reference/landing.html en page d'accueil (Next.js), avec le bouton de démo vers le widget du club fictif.

**Vérifier :** souscription en test, accès bloqué en fin d'essai sans carte.

---

## Avant les vrais clubs
- CGV, mentions légales, politique de confidentialité (et avis d'un avocat sur la loi Évin).
- Passer Stripe en production (SIRET nécessaire).
- Régénérer toute clé qui serait apparue en clair dans une conversation.
- Tester un samedi soir complet avec un club pilote.
