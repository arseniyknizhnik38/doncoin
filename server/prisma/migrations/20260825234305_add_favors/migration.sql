-- Еженедельные поручения (favors) и опыт семьи.

-- AlterTable
ALTER TABLE "Clan" ADD COLUMN     "familyXp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Favor" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "channelChatId" TEXT NOT NULL,
    "rewardDonc" BIGINT NOT NULL,
    "familyXpReward" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavorCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favorId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavorCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favor_weekNumber_active_idx" ON "Favor"("weekNumber", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Favor_weekNumber_channelName_key" ON "Favor"("weekNumber", "channelName");

-- CreateIndex
CREATE INDEX "FavorCompletion_userId_idx" ON "FavorCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavorCompletion_userId_favorId_key" ON "FavorCompletion"("userId", "favorId");

-- AddForeignKey
ALTER TABLE "FavorCompletion" ADD CONSTRAINT "FavorCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavorCompletion" ADD CONSTRAINT "FavorCompletion_favorId_fkey" FOREIGN KEY ("favorId") REFERENCES "Favor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

