-- AlterEnum : transfert à un proche, reprise par le club
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

-- AlterTable : réglages de revente
ALTER TABLE "Venue" ADD COLUMN "ticketTransfer" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "ticketBuyback" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "ticketBuybackHours" INTEGER NOT NULL DEFAULT 24,
                   ADD COLUMN "ticketBuybackPct" INTEGER NOT NULL DEFAULT 100;

-- AlterTable : traçabilité du transfert et du remboursement
ALTER TABLE "Ticket" ADD COLUMN "fromTicketId" TEXT,
                     ADD COLUMN "returnedAt" TIMESTAMP(3),
                     ADD COLUMN "refundCents" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_fromTicketId_fkey" FOREIGN KEY ("fromTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
