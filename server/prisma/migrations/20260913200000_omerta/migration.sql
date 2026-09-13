-- Шифр Омерты: попытки за день, день разгадки и итог последней попытки.
ALTER TABLE "User" ADD COLUMN "omertaDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "omertaAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "omertaSolvedDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "omertaLastHits" INTEGER;
CREATE INDEX "User_omertaSolvedDay_idx" ON "User"("omertaSolvedDay");
