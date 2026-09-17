-- Kural v3: domain/channel/logic/conditionsJson → workflowJson (aşamalı workflow).
-- Her v2 kuralı tek aşamaya çevrilir: koşulların hepsi kuralın bağlacını alır,
-- kanal tek aksiyon olur. Veri dönüşümü ADD ile DROP arasında; DDL prisma migrate diff'ten.

-- AlterTable (yeni kolonlar)
ALTER TABLE "public"."TrackingRule"
ADD COLUMN     "granularity" TEXT NOT NULL DEFAULT 'product',
ADD COLUMN     "maxRunsPerDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resetHours" INTEGER NOT NULL DEFAULT 168,
ADD COLUMN     "workflowJson" TEXT NOT NULL DEFAULT '{"stages":[]}';

ALTER TABLE "public"."TrackingRuleEvent"
ADD COLUMN     "actionsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "stageIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variantId" TEXT;

-- Veri: conditionsJson [c1, c2] + logic + channel →
-- {"stages":[{"conditions":[{"op":logic,"condition":c1},…],"actions":[{"type":"notify"|"email"}]}]}
-- Sıra WITH ORDINALITY ile korunur; bozuk/boş koşul listesi boş aşama dizisine düşer.
UPDATE "public"."TrackingRule" r SET "workflowJson" = COALESCE((
  SELECT jsonb_build_object('stages', jsonb_build_array(jsonb_build_object(
    'conditions', jsonb_agg(jsonb_build_object('op', r."logic", 'condition', e.c) ORDER BY e.i),
    'actions', jsonb_build_array(jsonb_build_object('type', CASE WHEN r."channel" = 'email' THEN 'email' ELSE 'notify' END))
  )))::text
  FROM jsonb_array_elements(r."conditionsJson"::jsonb) WITH ORDINALITY AS e(c, i)
  HAVING count(*) > 0
), '{"stages":[]}');

-- Geçmiş: eski tetiklerin kanalı tek başarılı aksiyon sonucu olur.
UPDATE "public"."TrackingRuleEvent" SET "actionsJson" = jsonb_build_array(jsonb_build_object(
  'type', CASE WHEN "channel" = 'email' THEN 'email' ELSE 'notify' END,
  'ok', true,
  'detail', CASE WHEN "channel" = 'email' THEN 'E-posta kuyruğa alındı' ELSE 'Zile düştü' END
))::text;

-- AlterTable (eski kolonlar)
ALTER TABLE "public"."TrackingRule" DROP COLUMN "channel",
DROP COLUMN "conditionsJson",
DROP COLUMN "domain",
DROP COLUMN "logic";

ALTER TABLE "public"."TrackingRuleEvent" DROP COLUMN "channel";

-- CreateTable
CREATE TABLE "public"."TrackingRuleState" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "stockAtStage" INTEGER NOT NULL,
    "soldAtStageKey" TEXT NOT NULL,
    "soldOnStageDay" INTEGER NOT NULL,
    "stageFiredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingRuleState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingRuleState_merchantId_ruleId_idx" ON "public"."TrackingRuleState"("merchantId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingRuleState_ruleId_targetKey_key" ON "public"."TrackingRuleState"("ruleId", "targetKey");

-- AddForeignKey
ALTER TABLE "public"."TrackingRuleState" ADD CONSTRAINT "TrackingRuleState_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."TrackingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
