-- CreateEnum
CREATE TYPE "GarageStatus" AS ENUM ('STORED', 'RETRIEVED', 'EXPIRED');

-- AlterTable : options liées aux bouteilles (couronne, cortège…)
ALTER TABLE "Show" ADD COLUMN "minBottles" INTEGER NOT NULL DEFAULT 0,
                  ADD COLUMN "bottleId" TEXT;

-- AlterTable : bouteille rendue depuis le garage
ALTER TABLE "OrderItem" ADD COLUMN "fromGarage" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable : réglages du garage
ALTER TABLE "Venue" ADD COLUMN "garageEnabled" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "garageMinBottles" INTEGER NOT NULL DEFAULT 1,
                   ADD COLUMN "garageDays" INTEGER NOT NULL DEFAULT 60,
                   ADD COLUMN "garageKeepsMin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable : réservation qui récupère une bouteille
ALTER TABLE "Reservation" ADD COLUMN "garageItemId" TEXT;

-- CreateTable
CREATE TABLE "GarageItem" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "bottleSizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "flavor" TEXT,
    "note" TEXT,
    "status" "GarageStatus" NOT NULL DEFAULT 'STORED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarageItem_code_key" ON "GarageItem"("code");

-- CreateIndex
CREATE INDEX "GarageItem_venueId_status_idx" ON "GarageItem"("venueId", "status");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageItem" ADD CONSTRAINT "GarageItem_bottleSizeId_fkey" FOREIGN KEY ("bottleSizeId") REFERENCES "BottleSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_garageItemId_fkey" FOREIGN KEY ("garageItemId") REFERENCES "GarageItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
