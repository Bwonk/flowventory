-- Satın alma siparişleri + tedarikçi tedarik ayarları. DDL prisma migrate diff'ten; kısmi indeks elle.
-- AlterTable
ALTER TABLE "public"."VendorContact" ADD COLUMN     "casePack" INTEGER,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "moq" INTEGER;

-- CreateTable
CREATE TABLE "public"."PurchaseOrder" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "number" INTEGER,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "qty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "cancelledQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PurchaseOrderReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "linesJson" TEXT NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_merchantId_status_idx" ON "public"."PurchaseOrder"("merchantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_merchantId_vendorId_status_idx" ON "public"."PurchaseOrder"("merchantId", "vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_merchantId_number_key" ON "public"."PurchaseOrder"("merchantId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_merchantId_variantId_idx" ON "public"."PurchaseOrderLine"("merchantId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_orderId_variantId_key" ON "public"."PurchaseOrderLine"("orderId", "variantId");

-- CreateIndex
CREATE INDEX "PurchaseOrderReceipt_merchantId_orderId_idx" ON "public"."PurchaseOrderReceipt"("merchantId", "orderId");

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tedarikçi başına tek açık taslak (Prisma kısmi indeksi modellemez; elle).
CREATE UNIQUE INDEX "PurchaseOrder_one_draft_per_vendor" ON "public"."PurchaseOrder"("merchantId", "vendorId") WHERE "status" = 'draft';
