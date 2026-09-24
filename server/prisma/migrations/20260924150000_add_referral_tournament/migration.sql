-- Недельный турнир кентов: момент зачёта друга и таблица итогов недели.
ALTER TABLE "User" ADD COLUMN "referralQualifiedAt" TIMESTAMP(3);

CREATE TABLE "ReferralTournamentResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "place" INTEGER NOT NULL,
    "qualified" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralTournamentResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralTournamentResult_weekNumber_place_key" ON "ReferralTournamentResult"("weekNumber", "place");

CREATE INDEX "ReferralTournamentResult_weekNumber_idx" ON "ReferralTournamentResult"("weekNumber");

ALTER TABLE "ReferralTournamentResult" ADD CONSTRAINT "ReferralTournamentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
