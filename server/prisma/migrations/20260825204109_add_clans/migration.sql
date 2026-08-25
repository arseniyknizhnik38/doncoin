-- Кланы: общая казна, владелец и участники.
-- Все колонки nullable или с DEFAULT, поэтому существующие игроки не задеты.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clanContributed" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "clanId" TEXT,
ADD COLUMN     "clanJoinedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treasury" BIGINT NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_ownerId_key" ON "Clan"("ownerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

