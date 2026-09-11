-- Дневная петля: бустеры, задания дня и шифр дня.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "boostDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fullEnergyUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rushUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rushEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyQuestDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "quests" TEXT[],
    "baseTaps" INTEGER NOT NULL DEFAULT 0,
    "baseEarned" BIGINT NOT NULL DEFAULT 0,
    "baseUpgrades" INTEGER NOT NULL DEFAULT 0,
    "baseBusiness" INTEGER NOT NULL DEFAULT 0,
    "baseDonated" BIGINT NOT NULL DEFAULT 0,
    "claimed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chestClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuestDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCipher" (
    "id" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCipher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CipherSolve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cipherId" TEXT NOT NULL,
    "reward" BIGINT NOT NULL DEFAULT 0,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CipherSolve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyQuestDay_dayNumber_idx" ON "DailyQuestDay"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuestDay_userId_dayNumber_key" ON "DailyQuestDay"("userId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCipher_dayNumber_key" ON "DailyCipher"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CipherSolve_userId_cipherId_key" ON "CipherSolve"("userId", "cipherId");

-- AddForeignKey
ALTER TABLE "DailyQuestDay" ADD CONSTRAINT "DailyQuestDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherSolve" ADD CONSTRAINT "CipherSolve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CipherSolve" ADD CONSTRAINT "CipherSolve_cipherId_fkey" FOREIGN KEY ("cipherId") REFERENCES "DailyCipher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
