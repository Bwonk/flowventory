-- CreateTable
CREATE TABLE "ProductSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "brandId" TEXT,
    "brandName" TEXT,
    "categoriesJson" TEXT,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "imageUrl" TEXT,
    "variantValuesJson" TEXT,
    "totalStock" INTEGER NOT NULL DEFAULT 0,
    "sellPrice" REAL NOT NULL DEFAULT 0,
    "buyPrice" REAL,
    "currencyCode" TEXT,
    "syncedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "date" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ProductSnapshot_merchantId_productId_idx" ON "ProductSnapshot"("merchantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSnapshot_merchantId_variantId_key" ON "ProductSnapshot"("merchantId", "variantId");

-- CreateIndex
CREATE INDEX "SalesDaily_merchantId_date_idx" ON "SalesDaily"("merchantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDaily_merchantId_variantId_date_key" ON "SalesDaily"("merchantId", "variantId", "date");

-- CreateIndex
CREATE INDEX "SyncLog_merchantId_type_finishedAt_idx" ON "SyncLog"("merchantId", "type", "finishedAt");
