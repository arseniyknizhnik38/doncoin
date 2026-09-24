-- Личные лиги: недельные группы и след игрока в них.
CREATE TABLE "LeagueGroup" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueGroup_weekNumber_tier_memberCount_idx" ON "LeagueGroup"("weekNumber", "tier", "memberCount");

ALTER TABLE "User" ADD COLUMN "leagueWeek" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "leagueTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "leagueGroupId" TEXT;
ALTER TABLE "User" ADD COLUMN "leagueLastGroupId" TEXT;
ALTER TABLE "User" ADD COLUMN "leagueStartEarned" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "leagueLastScore" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "leagueLastOutcome" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_leagueGroupId_fkey" FOREIGN KEY ("leagueGroupId") REFERENCES "LeagueGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
