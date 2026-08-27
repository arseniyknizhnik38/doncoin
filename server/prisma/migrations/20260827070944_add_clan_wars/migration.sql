-- CreateTable
CREATE TABLE "ClanWar" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "clanAId" TEXT NOT NULL,
    "clanBId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "scoreA" BIGINT NOT NULL DEFAULT 0,
    "scoreB" BIGINT NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "potPaid" BIGINT NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanWar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanWarEntry" (
    "id" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTotal" BIGINT NOT NULL,
    "frozenEarned" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanWarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClanWar_status_endsAt_idx" ON "ClanWar"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWar_weekNumber_clanAId_key" ON "ClanWar"("weekNumber", "clanAId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWar_weekNumber_clanBId_key" ON "ClanWar"("weekNumber", "clanBId");

-- CreateIndex
CREATE INDEX "ClanWarEntry_warId_clanId_idx" ON "ClanWarEntry"("warId", "clanId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanWarEntry_warId_userId_key" ON "ClanWarEntry"("warId", "userId");

-- AddForeignKey
ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_clanAId_fkey" FOREIGN KEY ("clanAId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_clanBId_fkey" FOREIGN KEY ("clanBId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanWar" ADD CONSTRAINT "ClanWar_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanWarEntry" ADD CONSTRAINT "ClanWarEntry_warId_fkey" FOREIGN KEY ("warId") REFERENCES "ClanWar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanWarEntry" ADD CONSTRAINT "ClanWarEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
