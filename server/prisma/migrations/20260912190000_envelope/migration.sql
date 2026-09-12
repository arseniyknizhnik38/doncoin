-- Конверт: единственная награда, размер которой заранее неизвестен.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "envelopeDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "envelopeTier" TEXT,
ADD COLUMN     "envelopeAmount" BIGINT NOT NULL DEFAULT 0;
