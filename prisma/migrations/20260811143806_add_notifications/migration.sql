-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "productId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MerchantSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "criticalThreshold" INTEGER NOT NULL DEFAULT 5,
    "warningThreshold" INTEGER NOT NULL DEFAULT 10,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "currencyCode" TEXT NOT NULL DEFAULT 'TRY',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "targetStockDays" INTEGER NOT NULL DEFAULT 30,
    "notificationEmail" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MerchantSettings" ("createdAt", "criticalThreshold", "currencyCode", "id", "leadTimeDays", "merchantId", "targetStockDays", "timezone", "updatedAt", "warningThreshold") SELECT "createdAt", "criticalThreshold", "currencyCode", "id", "leadTimeDays", "merchantId", "targetStockDays", "timezone", "updatedAt", "warningThreshold" FROM "MerchantSettings";
DROP TABLE "MerchantSettings";
ALTER TABLE "new_MerchantSettings" RENAME TO "MerchantSettings";
CREATE UNIQUE INDEX "MerchantSettings_merchantId_key" ON "MerchantSettings"("merchantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Notification_merchantId_createdAt_idx" ON "Notification"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_merchantId_dedupeKey_key" ON "Notification"("merchantId", "dedupeKey");
