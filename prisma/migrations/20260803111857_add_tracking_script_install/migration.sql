-- CreateTable
CREATE TABLE "TrackingScriptInstall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingScriptInstall_merchantId_key" ON "TrackingScriptInstall"("merchantId");
