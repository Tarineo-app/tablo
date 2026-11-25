-- Paiements en ligne (Stripe Connect) et abonnement des clubs (Stripe Billing)
ALTER TABLE "Venue" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Venue" ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Venue" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Venue" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "Venue" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Venue" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Venue_stripeSubscriptionId_key" ON "Venue"("stripeSubscriptionId");

ALTER TABLE "Reservation" ADD COLUMN "holdUntil" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Reservation_stripeSessionId_key" ON "Reservation"("stripeSessionId");

-- Relances automatiques
ALTER TABLE "Venue" ADD COLUMN "trialReportSentAt" TIMESTAMP(3);
