import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Une seule instance de Prisma en développement (le rechargement à chaud en recréerait sinon à chaque fois).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante : copiez .env.example vers .env.local et remplissez-la.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const db = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
