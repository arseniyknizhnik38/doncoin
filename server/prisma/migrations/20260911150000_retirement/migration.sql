-- Уход на покой: игрок, дошедший до «Дона ★★★», может начать заново ради
-- постоянной прибавки к доходу.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "retirements" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeEarned" BIGINT NOT NULL DEFAULT 0;

-- У всех, кто уже играл, пожизненный заработок равен накопленному: кругов
-- ещё не было.
UPDATE "User" SET "lifetimeEarned" = "totalEarned";

-- CreateIndex
CREATE INDEX "User_lifetimeEarned_idx" ON "User"("lifetimeEarned");
