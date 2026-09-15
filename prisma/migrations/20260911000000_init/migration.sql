-- CreateTable
CREATE TABLE "public"."AuthToken" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "authorizedAppId" TEXT,
    "salesChannelId" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "expiresIn" INTEGER NOT NULL,
    "expireDate" TIMESTAMP(3) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductView" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductViewHourly" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductViewHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MerchantSettings" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "productId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductSnapshot" (
    "id" TEXT NOT NULL,
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
    "sellPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyPrice" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesDaily" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "date" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SalesDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackingScriptInstall" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingScriptInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VendorContact" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DigestLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "DigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_authorizedAppId_key" ON "public"."AuthToken"("authorizedAppId");

-- CreateIndex
CREATE INDEX "ProductView_merchantId_productId_idx" ON "public"."ProductView"("merchantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductView_merchantId_productId_date_key" ON "public"."ProductView"("merchantId", "productId", "date");

-- CreateIndex
CREATE INDEX "ProductViewHourly_merchantId_productId_date_idx" ON "public"."ProductViewHourly"("merchantId", "productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductViewHourly_merchantId_productId_date_hour_key" ON "public"."ProductViewHourly"("merchantId", "productId", "date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSettings_merchantId_key" ON "public"."MerchantSettings"("merchantId");

-- CreateIndex
CREATE INDEX "Notification_merchantId_createdAt_idx" ON "public"."Notification"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_merchantId_dedupeKey_key" ON "public"."Notification"("merchantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ProductSnapshot_merchantId_productId_idx" ON "public"."ProductSnapshot"("merchantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSnapshot_merchantId_variantId_key" ON "public"."ProductSnapshot"("merchantId", "variantId");

-- CreateIndex
CREATE INDEX "SalesDaily_merchantId_date_idx" ON "public"."SalesDaily"("merchantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDaily_merchantId_variantId_date_key" ON "public"."SalesDaily"("merchantId", "variantId", "date");

-- CreateIndex
CREATE INDEX "SyncLog_merchantId_type_finishedAt_idx" ON "public"."SyncLog"("merchantId", "type", "finishedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_scope_idx" ON "public"."WebhookEvent"("merchantId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingScriptInstall_merchantId_key" ON "public"."TrackingScriptInstall"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorContact_merchantId_vendorId_key" ON "public"."VendorContact"("merchantId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_merchantId_periodKey_key" ON "public"."DigestLog"("merchantId", "periodKey");

