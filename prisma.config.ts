import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 : les URLs de connexion vivent ici, plus dans schema.prisma.
// DIRECT_URL = connexion directe Supabase (port 5432), utilisée pour les migrations.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DIRECT_URL") },
});
