ALTER TABLE "Notification" ADD COLUMN "targetType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "targetId" TEXT;

CREATE INDEX "Notification_targetType_targetId_idx" ON "Notification"("targetType", "targetId");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
