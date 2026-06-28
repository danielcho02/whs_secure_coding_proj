-- Extend reports with moderation metadata and duplicate-report protection.
ALTER TABLE "Report"
ADD COLUMN "adminId" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "adminNote" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Report_reporterId_type_targetId_key" ON "Report"("reporterId", "type", "targetId");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_type_idx" ON "Report"("type");
CREATE INDEX "Report_adminId_idx" ON "Report"("adminId");

ALTER TABLE "Report"
ADD CONSTRAINT "Report_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Store target metadata separately so admin log listing does not parse detail JSON.
ALTER TABLE "AdminLog"
ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "reason" TEXT;

ALTER TABLE "AdminLog" ALTER COLUMN "targetType" DROP DEFAULT;

CREATE INDEX "AdminLog_adminId_idx" ON "AdminLog"("adminId");
CREATE INDEX "AdminLog_action_idx" ON "AdminLog"("action");
CREATE INDEX "AdminLog_targetType_targetId_idx" ON "AdminLog"("targetType", "targetId");
