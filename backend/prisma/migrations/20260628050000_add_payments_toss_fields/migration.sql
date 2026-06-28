-- Add Toss sandbox/test payment tracking fields.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

ALTER TABLE "Payment"
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "orderName" TEXT,
  ADD COLUMN "receiptUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Payment"
SET
  "orderId" = CONCAT('legacy_', "id"),
  "orderName" = 'Legacy payment'
WHERE "orderId" IS NULL;

ALTER TABLE "Payment"
  ALTER COLUMN "orderId" SET NOT NULL,
  ALTER COLUMN "orderName" SET NOT NULL;

CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
