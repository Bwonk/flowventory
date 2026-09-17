-- Kural v2: tek-metrik kolonlar → conditionsJson (tek koşul), emailEnabled → channel,
-- windowHours → cooldownHours. Veri dönüşümü ADD ile DROP arasında; DDL prisma migrate diff'ten.

-- AlterTable (yeni kolonlar)
ALTER TABLE "public"."TrackingRule"
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'notification',
ADD COLUMN     "conditionsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "cooldownHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'stok',
ADD COLUMN     "logic" TEXT NOT NULL DEFAULT 'and';

-- Veri: mevcut tek-metrik kural → tek koşul. Ölçüm penceresi olmayan metriklerde
-- (stock_below, days_of_cover_below) windowHours JSON'a yazılmaz; hepsinde
-- yeniden bildirim aralığı eski windowHours'tur.
UPDATE "public"."TrackingRule" SET
  "conditionsJson" = CASE
    WHEN "metric" = 'stock_drop' THEN json_build_array(json_build_object(
      'metric', "metric", 'threshold', "threshold", 'thresholdUnit', "thresholdUnit", 'windowHours', "windowHours"))::text
    WHEN "metric" IN ('sales_above') THEN json_build_array(json_build_object(
      'metric', "metric", 'threshold', "threshold", 'windowHours', "windowHours"))::text
    WHEN "metric" = 'no_sales' THEN json_build_array(json_build_object(
      'metric', "metric", 'windowHours', "windowHours"))::text
    ELSE json_build_array(json_build_object(
      'metric', "metric", 'threshold', "threshold"))::text
  END,
  "channel" = CASE WHEN "emailEnabled" THEN 'email' ELSE 'notification' END,
  "cooldownHours" = "windowHours",
  "domain" = 'stok';

-- AlterTable (eski kolonlar)
ALTER TABLE "public"."TrackingRule" DROP COLUMN "emailEnabled",
DROP COLUMN "metric",
DROP COLUMN "threshold",
DROP COLUMN "thresholdUnit",
DROP COLUMN "windowHours";

-- CreateTable
CREATE TABLE "public"."TrackingRuleEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingRuleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingRuleEvent_merchantId_ruleId_createdAt_idx" ON "public"."TrackingRuleEvent"("merchantId", "ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "TrackingRuleEvent_createdAt_idx" ON "public"."TrackingRuleEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingRuleEvent_merchantId_dedupeKey_key" ON "public"."TrackingRuleEvent"("merchantId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "public"."TrackingRuleEvent" ADD CONSTRAINT "TrackingRuleEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."TrackingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
