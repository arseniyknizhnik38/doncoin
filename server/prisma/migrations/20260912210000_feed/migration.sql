-- Лента «Что слышно»: новости семей и редкие события игроков.

-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "rival" TEXT,
    "amount" BIGINT,
    "rank" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");

-- О какой ступени ранга уже объявляли: ранг считается от заработка, момента
-- повышения в базе нет, и без этой отметки объявление повторялось бы при
-- каждом заходе.
ALTER TABLE "User" ADD COLUMN "feedRankStep" INTEGER NOT NULL DEFAULT 0;

-- Уже играющим ставим текущую ступень, чтобы лента не объявила разом всех,
-- кто давно на «Капо».
UPDATE "User"
SET "feedRankStep" = CASE
  WHEN "totalEarned" >= 645000000000 THEN 17
  WHEN "totalEarned" >= 207000000000 THEN 16
  WHEN "totalEarned" >= 66000000000  THEN 15
  WHEN "totalEarned" >= 21000000000  THEN 14
  WHEN "totalEarned" >= 6800000000   THEN 13
  WHEN "totalEarned" >= 2200000000   THEN 12
  WHEN "totalEarned" >= 700000000    THEN 11
  WHEN "totalEarned" >= 224000000    THEN 10
  WHEN "totalEarned" >= 72000000     THEN 9
  ELSE 0
END;
