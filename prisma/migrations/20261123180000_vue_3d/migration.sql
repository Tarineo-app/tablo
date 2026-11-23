-- AlterTable : réglages de la vue 3D du plan
ALTER TABLE "Venue" ADD COLUMN "plan3d" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "planTilt" INTEGER NOT NULL DEFAULT 52,
                   ADD COLUMN "wallColor" TEXT,
                   ADD COLUMN "tour3dUrl" TEXT;

-- AlterTable : rendu 3D par catégorie de carré
ALTER TABLE "TableCategory" ADD COLUMN "color" TEXT,
                            ADD COLUMN "elevation" INTEGER NOT NULL DEFAULT 2;
