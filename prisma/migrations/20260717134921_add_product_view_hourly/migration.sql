-- CreateTable
CREATE TABLE "ProductViewHourly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProductViewHourly_productId_date_idx" ON "ProductViewHourly"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductViewHourly_productId_date_hour_key" ON "ProductViewHourly"("productId", "date", "hour");
