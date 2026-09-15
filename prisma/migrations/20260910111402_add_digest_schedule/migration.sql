-- CreateTable
CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
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
    "digestFrequency" TEXT NOT NULL DEFAULT 'off',
    "digestWeekday" INTEGER NOT NULL DEFAULT 1,
    "digestHour" INTEGER NOT NULL DEFAULT 9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_MerchantSettings" ("createdAt", "criticalThreshold", "currencyCode", "emailNotifications", "id", "leadTimeDays", "merchantId", "notificationEmail", "targetStockDays", "timezone", "updatedAt", "warningThreshold") SELECT "createdAt", "criticalThreshold", "currencyCode", "emailNotifications", "id", "leadTimeDays", "merchantId", "notificationEmail", "targetStockDays", "timezone", "updatedAt", "warningThreshold" FROM "MerchantSettings";
DROP TABLE "MerchantSettings";
ALTER TABLE "new_MerchantSettings" RENAME TO "MerchantSettings";
CREATE UNIQUE INDEX "MerchantSettings_merchantId_key" ON "MerchantSettings"("merchantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_merchantId_periodKey_key" ON "DigestLog"("merchantId", "periodKey");
