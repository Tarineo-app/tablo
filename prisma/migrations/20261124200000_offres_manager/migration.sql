-- Les offres du manager commercial : il compose la soirée d'un client,
-- fixe son prix, envoie un lien. Et l'inverse : le client demande, il chiffre.
CREATE TYPE "OfferStatus" AS ENUM ('REQUESTED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "managerId" TEXT,
  "tableId" TEXT,
  "status" "OfferStatus" NOT NULL DEFAULT 'SENT',
  "code" TEXT NOT NULL,
  "guests" INTEGER NOT NULL DEFAULT 4,
  "clientName" TEXT,
  "clientEmail" TEXT,
  "clientPhone" TEXT,
  "message" TEXT,
  "askNote" TEXT,
  "signText" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "listCents" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "reservationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferItem" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "bottleSizeId" TEXT,
  "showId" TEXT,
  "flavor" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCents" INTEGER NOT NULL DEFAULT 0,
  "offered" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Offer_code_key" ON "Offer"("code");
CREATE UNIQUE INDEX "Offer_reservationId_key" ON "Offer"("reservationId");
CREATE INDEX "Offer_venueId_eventId_idx" ON "Offer"("venueId", "eventId");
CREATE INDEX "Offer_venueId_status_idx" ON "Offer"("venueId", "status");

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VenueTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_bottleSizeId_fkey" FOREIGN KEY ("bottleSizeId") REFERENCES "BottleSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un envoi peut désormais porter un show, pas seulement des bouteilles.
ALTER TABLE "OrderItem" ALTER COLUMN "bottleSizeId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD COLUMN "showId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La billetterie se ferme par défaut : le cœur du produit, c'est le carré.
ALTER TABLE "Venue" ADD COLUMN "ticketsEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Venue" SET "ticketsEnabled" = true WHERE "isDemo" = true;

-- La cagnotte sort du parcours : plus proposée par défaut.
ALTER TABLE "Venue" ALTER COLUMN "payModes" SET DEFAULT ARRAY['FULL', 'CASH']::"PayMode"[];
UPDATE "Venue" SET "payModes" = array_remove("payModes", 'POOL');
