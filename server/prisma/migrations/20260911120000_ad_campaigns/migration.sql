-- Поручения превращаются в рекламные кампании, которыми управляют из
-- админки: срок вместо номера недели, лимит подписок и счётчик выданных
-- наград, награда в часах дохода вместо фиксированной суммы.

-- AlterTable
ALTER TABLE "Favor" ADD COLUMN     "advertiser" TEXT,
ADD COLUMN     "rewardHours" DOUBLE PRECISION,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "slots" INTEGER,
ADD COLUMN     "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Favor" ALTER COLUMN "weekNumber" SET DEFAULT 0;

-- Уже выданные награды переносим в счётчик, иначе лимит на старых кампаниях
-- считался бы с нуля.
UPDATE "Favor" f
SET "completedCount" = (
  SELECT COUNT(*) FROM "FavorCompletion" c WHERE c."favorId" = f."id"
);

-- Прежние недельные поручения делаем бессрочными: недели больше нет, а
-- гасить работающую кампанию миграцией нельзя.
--
-- Ключ (weekNumber, channelName) уникален, поэтому на нулевую неделю может
-- переехать только одно поручение на канал. Если их было несколько, берём
-- самое свежее, а остальные гасим: две кампании на один канал всё равно
-- бессмысленны — подписка-то одна.
UPDATE "Favor" SET "active" = false
WHERE "active" = true
  AND "id" NOT IN (
    SELECT DISTINCT ON ("channelName") "id"
    FROM "Favor"
    WHERE "active" = true
    ORDER BY "channelName", "weekNumber" DESC, "createdAt" DESC
  );

UPDATE "Favor" SET "weekNumber" = 0 WHERE "active" = true;

-- Неактивные поручения прошлых недель оставляем как есть: их weekNumber уже
-- уникален в паре с каналом, а трогать историю незачем.

-- DropIndex
DROP INDEX IF EXISTS "Favor_weekNumber_active_idx";

-- CreateIndex
CREATE INDEX "Favor_active_sortOrder_idx" ON "Favor"("active", "sortOrder");
