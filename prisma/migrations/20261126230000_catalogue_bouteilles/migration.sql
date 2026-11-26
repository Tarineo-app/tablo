-- Catalogue Tablo : bouteille reliée au catalogue, et sa description
ALTER TABLE "Bottle" ADD COLUMN "catalogId" TEXT;
ALTER TABLE "Bottle" ADD COLUMN "description" TEXT;
CREATE INDEX "Bottle_venueId_catalogId_idx" ON "Bottle"("venueId", "catalogId");
