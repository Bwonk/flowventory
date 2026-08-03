/*
  Warnings:

  - Added the required column `merchantId` to the `ProductView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `merchantId` to the `ProductViewHourly` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProductView" ("createdAt", "date", "id", "productId", "updatedAt", "viewCount") SELECT "createdAt", "date", "id", "productId", "updatedAt", "viewCount" FROM "ProductView";
DROP TABLE "ProductView";
ALTER TABLE "new_ProductView" RENAME TO "ProductView";
CREATE INDEX "ProductView_merchantId_productId_idx" ON "ProductView"("merchantId", "productId");
CREATE UNIQUE INDEX "ProductView_merchantId_productId_date_key" ON "ProductView"("merchantId", "productId", "date");
CREATE TABLE "new_ProductViewHourly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProductViewHourly" ("createdAt", "date", "hour", "id", "productId", "updatedAt", "viewCount") SELECT "createdAt", "date", "hour", "id", "productId", "updatedAt", "viewCount" FROM "ProductViewHourly";
DROP TABLE "ProductViewHourly";
ALTER TABLE "new_ProductViewHourly" RENAME TO "ProductViewHourly";
CREATE INDEX "ProductViewHourly_merchantId_productId_date_idx" ON "ProductViewHourly"("merchantId", "productId", "date");
CREATE UNIQUE INDEX "ProductViewHourly_merchantId_productId_date_hour_key" ON "ProductViewHourly"("merchantId", "productId", "date", "hour");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
