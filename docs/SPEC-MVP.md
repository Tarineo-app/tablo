# Tablo — spécification du MVP

Objectif du MVP : qu'un club pilote vende ses carrés en ligne avec acompte, cagnotte et liens managers,
et que ses serveurs reçoivent les envois sur leur téléphone. Tout le reste attend la V2.

## 1. Parcours client (widget public)
1. **Soirée et groupe** : choix de la date (soirées ouvertes par le club) et du nombre de personnes. Affichage des règles du club (âge minimum, tenue).
2. **Plan 2D** : les carrés placés par le club sur son plan (image de fond + rectangles). Carré pris = grisé. Chaque carré montre sa catégorie, sa capacité, son minimum et ses shows inclus. Photo réelle du carré si fournie.
3. **Bouteilles** : liste avec photo, formats (75 cl, Magnum…), goûts éventuels, prix, stock. Barre de progression vers le minimum du carré ; impossible de continuer sous le minimum.
4. **Pancarte et shows** : texte libre sur la pancarte du club (aperçu = photo de la pancarte + texte superposé). Shows inclus selon la catégorie (le client choisit lesquels), puis shows payants en plus.
5. **Paiement** (3 modes, activables par le club) :
   - **Complet** : tout est payé maintenant.
   - **Cagnotte** : l'organisateur paie au moins l'acompte, enregistre sa carte, et partage un lien. Chacun paie le montant qu'il veut.
   - **Espèces** : l'acompte est payé en ligne, le reste se règle sur place.
6. **Confirmation** : QR code d'entrée, récapitulatif, email.

## 2. Règles métier
- **Catégories de carré** (définies par le club) : nom, % d'acompte obligatoire (0 à 100), nombre de shows inclus, minimum par défaut.
- **Acompte** = `ceil(total × depositPct / 100)`. Si `depositPct = 0`, réservation possible sans paiement immédiat (carte enregistrée en garantie).
- **Minimum** : le total bouteilles doit atteindre le minimum du carré (pouvant être surchargé pour une soirée).
- **Cagnotte** :
  - L'organisateur paie au moins l'acompte, et sa carte est enregistrée (`setup_future_usage: off_session`).
  - Les amis paient via `/c/[token]` (montant libre ≥ 5 €, jamais au-delà du reste à payer).
  - Échéance : la veille de la soirée à 18 h (réglable). À l'échéance, le reste est débité sur la carte de l'organisateur (PaymentIntent off_session). Rappels email à J-2 et J-1 matin.
  - Échec du débit → statut `PAYMENT_ISSUE`, notification au club.
- **Envois** : chaque commande pendant la soirée crée un `Order` numéroté (n°1 = commande initiale, n°2, n°3…). Statuts : `NEW` → `TAKEN` (serveur « Je prends ») → `SERVED`.
- **Managers commerciaux** : chaque manager a un `code` de lien. Une réservation faite via son lien lui est attribuée (`managerId`). Il peut créer des réservations pour ses clients depuis l'espace club. Commission = % fixé par le directeur, calculée sur le total payé (affichage seulement, pas de virement automatique).
- **Annulation** : politique texte définie par le club ; remboursements manuels depuis l'espace club (Stripe refund).

## 3. Statuts d'une réservation
`DRAFT` (panier) → `PENDING_PAYMENT` → `CONFIRMED` (acompte ou total payé) → `FULLY_PAID` → `CHECKED_IN` → `COMPLETED`.
Autres : `CANCELLED`, `NO_SHOW`, `PAYMENT_ISSUE`.

## 4. Espace club (MVP)
- Onboarding guidé : établissement (nom, ville, logo, couleurs) → catégories → plan 2D (import d'image + placement des carrés à la souris) → bouteilles → pancarte → shows → soirées → paiements (Stripe Connect) → équipe → code d'intégration.
- Réservations du soir : liste + plan en direct, détail d'un carré, check-in par scan du QR.
- Équipe : inviter par email avec un rôle.
- Personnalisation du widget : logo, couleur principale, fond clair/sombre, police (3 choix).

## 5. App serveur (MVP)
Mobile d'abord. Onglets « Mes carrés » / « Tous » / « Bar ». Chaque envoi : carré, numéro d'envoi, articles, montant en espèces à encaisser. Boutons « Je prends » puis « Servi ». Mise à jour en temps réel.

## 6. V2 (après les pilotes)
Plan 3D et vues 360°, bouteilles 3D, détourage auto, shows générés par IA, fidélité (1 € = 1 pt, organisateur ×2) et Top 3, objectifs par soirée, packages managers à leurs prix, multi-établissements, offre 299 €.
