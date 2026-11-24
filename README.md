# Tablo

Le widget de réservation de carrés VIP pour clubs, beach clubs et soirées à thème.

## Lancer le projet sur ton Mac (première fois)

1. **Place le projet hors iCloud** : décompresse-le dans `~/dev/tablo` (pas sur le Bureau ni dans Documents).
2. **Installe les dépendances** (dans le Terminal) :
   ```
   cd ~/dev/tablo
   npm install
   ```
3. **Crée la base de données** sur [supabase.com](https://supabase.com) : nouveau projet, région **Frankfurt**, note le mot de passe.
   Puis *Project Settings > Database > Connection string* : copie l'URL « Transaction pooler » (port 6543) et l'URL directe (port 5432).
4. **Remplis les variables** :
   ```
   cp .env.example .env.local
   cp .env.example .env
   ```
   Ouvre les deux fichiers et colle `DATABASE_URL`, `DIRECT_URL`. Pour `SESSION_SECRET`, lance `openssl rand -base64 32` et colle le résultat.
5. **Crée les tables** puis le **club de démo** :
   ```
   npx prisma migrate dev --name init
   npm run db:seed
   ```
6. **Lance le site** :
   ```
   npm run dev
   ```
   - Landing page : http://localhost:3000
   - Espace club : http://localhost:3000/connexion (compte démo : `demo@tablo.club` / `tablo-demo`)
   - Widget du club de démo : http://localhost:3000/w/le-velours
   - Billetterie du club de démo : http://localhost:3000/w/le-velours/billets

## Connexion avec Google (facultatif)

Sans ces clés, tout marche avec email et mot de passe ; le bouton Google n'apparaît simplement pas.

1. Va sur [Google Cloud Console](https://console.cloud.google.com/), crée un projet « Tablo ».
2. *APIs & Services > OAuth consent screen* : type **External**, nom « Tablo », ton email, puis enregistre.
3. *APIs & Services > Credentials > Create credentials > OAuth client ID*, type **Web application**.
4. Dans **Authorized redirect URIs**, ajoute :
   - `http://localhost:3000/auth/google/callback`
   - `https://TON-DOMAINE/auth/google/callback` (une fois en ligne)
5. Copie l'identifiant et la clé dans `.env.local` : `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

## Mettre en ligne (Vercel)

1. **Le dépôt GitHub.** Sur [github.com/new](https://github.com/new) : nom `tablo`, **Private**, aucune case à cocher (ni README, ni .gitignore, ni licence). Créer.
2. **Sur Vercel**, *Add New > Project*, choisir le dépôt `tablo`. Région : **Paris (cdg1)**.
3. **Variables d'environnement** (*Settings > Environment Variables*), pour Production, Preview et Development :

   | Variable | Où la trouver |
   | --- | --- |
   | `DATABASE_URL` | Supabase > Database > Connection string, « Transaction pooler » (port 6543) |
   | `DIRECT_URL` | la même, connexion directe (port 5432) |
   | `SESSION_SECRET` | `openssl rand -base64 32` — **une valeur neuve, différente de celle du Mac** |
   | `NEXT_PUBLIC_APP_URL` | l'adresse Vercel, sans `/` final |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | facultatif, pour le bouton Google |

4. Le script `vercel-build` génère Prisma, applique les migrations puis construit le site. Rien à lancer à la main.
5. Dans Google Cloud, ajouter l'URI de redirection `https://<adresse-vercel>/auth/google/callback`.

## La démo sans compte

`/demo-club` ouvre l'espace club **sans inscription ni mot de passe** : pratique pour montrer le produit à un patron de boîte, ou pour laisser quelqu'un regarder sans rien créer. Un bouton y mène depuis la page d'accueil.

Pour l'activer, mets `DEMO_LOGIN=1` dans l'environnement (en local comme sur Vercel). Sans ça, le lien renvoie vers la page de connexion.

Trois garde-fous :
- la session de démo ne dure **qu'une heure** et ne donne accès qu'à l'établissement marqué `isDemo` (« Le Velours » du seed) ;
- les actions qui touchent au compte, à l'équipe ou à l'abonnement sont **refusées** (inviter, changer un rôle, retirer quelqu'un, choisir la soirée d'essai) ;
- tout le reste est manipulable : c'est l'intérêt. Pour remettre la démo à neuf, supprime le club et relance `npm run db:seed`.

## Travailler à deux

**Sur GitHub** : *Settings > Collaborators > Add people*, mettre le pseudo GitHub de ton pote. Il reçoit une invitation par email.

**Sur Vercel** : il crée un compte Vercel, puis depuis le projet *Settings > Members* (ou l'équipe, si tu en crées une) tu l'ajoutes. Il voit alors les déploiements et les logs.

**Chez lui, pour développer** :
```
git clone https://github.com/<ton-pseudo>/tablo.git ~/dev/tablo
cd ~/dev/tablo
npm install
cp .env.example .env.local && cp .env.example .env
```
Il remplit ses variables (il peut utiliser **sa propre** base Supabase gratuite pour ne pas toucher aux vraies données), puis :
```
npx prisma migrate deploy && npm run db:seed && npm run dev
```

**La règle de base** : jamais de `.env` dans Git, jamais de mot de passe collé dans un chat ou un message. Chacun a ses propres clés. Le `.gitignore` bloque déjà tous les `.env*`.

**Pour travailler sans se marcher dessus** : une branche par sujet.
```
git checkout -b stripe
git push -u origin stripe
```
Vercel construit automatiquement un aperçu de chaque branche, avec sa propre adresse : vous pouvez tester avant de fusionner dans `main`.

## Continuer avec Claude Code

Ouvre le dossier et lance `claude`. Le fichier `CLAUDE.md` explique le projet et ce qui reste à faire ;
`docs/PROMPTS.md` donne le prompt de chaque étape. Les étapes 0 à 3 sont faites : commence à l'**étape 4 (paiements Stripe)**.
