-- Отстёгивание наверх: доля дохода с бизнесов уходит в кассу семьи.

-- AlterTable
ALTER TABLE "Clan" ADD COLUMN "tributePercent" INTEGER NOT NULL DEFAULT 10;
