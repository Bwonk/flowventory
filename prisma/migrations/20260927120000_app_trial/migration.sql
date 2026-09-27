-- Deneme süresi kaydı (uygulama tutar; uninstall purge'üne dahil değil). DDL prisma migrate diff'ten.
-- CreateTable
CREATE TABLE "public"."AppTrial" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTrial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppTrial_merchantId_key" ON "public"."AppTrial"("merchantId");
