import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 : les URLs de connexion vivent ici, plus dans schema.prisma.
// DIRECT_URL = connexion directe Supabase (port 5432), utilisée pour les migrations.
// Tant qu'elle n'est pas renseignée, `prisma generate` doit quand même marcher
// (sinon `npm install` échoue avant même que le fichier .env existe).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL ? env("DIRECT_URL") : "postgresql://user:password@localhost:5432/placeholder" },
});
