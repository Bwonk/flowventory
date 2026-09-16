-- CreateTable
CREATE TABLE "public"."StockHistory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "totalStock" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockHistory_merchantId_variantId_recordedAt_idx" ON "public"."StockHistory"("merchantId", "variantId", "recordedAt");

-- CreateIndex
CREATE INDEX "StockHistory_merchantId_productId_recordedAt_idx" ON "public"."StockHistory"("merchantId", "productId", "recordedAt");

-- CreateIndex
CREATE INDEX "StockHistory_recordedAt_idx" ON "public"."StockHistory"("recordedAt");

