-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "ruleId" TEXT;

-- CreateTable
CREATE TABLE "public"."TrackingRule" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "metric" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "thresholdUnit" TEXT NOT NULL DEFAULT 'units',
    "windowHours" INTEGER NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingRule_merchantId_enabled_idx" ON "public"."TrackingRule"("merchantId", "enabled");

