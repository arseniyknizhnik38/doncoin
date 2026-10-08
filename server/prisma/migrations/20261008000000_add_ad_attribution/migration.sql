-- Рекламная метка игрока: источник, площадка, click id и две временные точки.
ALTER TABLE "User" ADD COLUMN "adSource" TEXT;
ALTER TABLE "User" ADD COLUMN "adPlacement" TEXT;
ALTER TABLE "User" ADD COLUMN "adClickId" TEXT;
ALTER TABLE "User" ADD COLUMN "adLandedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "adConvertedAt" TIMESTAMP(3);

CREATE INDEX "User_adSource_adPlacement_idx" ON "User"("adSource", "adPlacement");

-- Журнал конверсий: отправленные, отклонённые антифродом и не принятые сетью.
CREATE TABLE "AdConversionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT,
    "placement" TEXT,
    "clickId" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdConversionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdConversionLog_userId_reason_key" ON "AdConversionLog"("userId", "reason");
CREATE INDEX "AdConversionLog_status_createdAt_idx" ON "AdConversionLog"("status", "createdAt");
CREATE INDEX "AdConversionLog_ipHash_createdAt_idx" ON "AdConversionLog"("ipHash", "createdAt");

ALTER TABLE "AdConversionLog" ADD CONSTRAINT "AdConversionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
