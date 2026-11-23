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

## Mettre en ligne (Vercel)

1. Pousse le projet sur un dépôt GitHub privé.
2. Sur Vercel : *Add New > Project*, choisis le dépôt.
3. Dans *Settings > Environment Variables*, ajoute `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL` (l'adresse Vercel ou ton domaine).
4. Le script `vercel-build` génère Prisma, applique les migrations puis construit le site.

## Continuer avec Claude Code

Ouvre le dossier et lance `claude`. Le fichier `CLAUDE.md` explique le projet et ce qui reste à faire ;
`docs/PROMPTS.md` donne le prompt de chaque étape. Les étapes 0 à 3 sont faites : commence à l'**étape 4 (paiements Stripe)**.
