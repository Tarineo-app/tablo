-- Essai par soirée : le club ouvre une nuit offerte, puis paie pour la suivante.
CREATE TYPE "Billing" AS ENUM ('SETUP', 'TRIAL', 'ACTIVE', 'LOCKED');

ALTER TABLE "Venue"
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "billing" "Billing" NOT NULL DEFAULT 'SETUP',
  ADD COLUMN "trialEventId" TEXT,
  ADD COLUMN "trialPickedAt" TIMESTAMP(3),
  ADD COLUMN "trialClosedAt" TIMESTAMP(3);
