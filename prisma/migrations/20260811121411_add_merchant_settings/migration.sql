-- CreateTable
CREATE TABLE "MerchantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "criticalThreshold" INTEGER NOT NULL DEFAULT 5,
    "warningThreshold" INTEGER NOT NULL DEFAULT 10,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "currencyCode" TEXT NOT NULL DEFAULT 'TRY',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "targetStockDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettings_merchantId_key" ON "MerchantSettings"("merchantId");
