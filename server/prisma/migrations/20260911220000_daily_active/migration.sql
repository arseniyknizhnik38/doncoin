-- История заходов по дням: без неё нельзя посчитать удержание, потому что
-- lastSeenAt хранит только последний визит.

-- CreateTable
CREATE TABLE "DailyActive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,

    CONSTRAINT "DailyActive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyActive_dayNumber_idx" ON "DailyActive"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActive_userId_dayNumber_key" ON "DailyActive"("userId", "dayNumber");

-- AddForeignKey
ALTER TABLE "DailyActive" ADD CONSTRAINT "DailyActive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- День регистрации засчитываем всем, кто уже есть: в этот день человек
-- заходил заведомо, иначе строки бы не было.
INSERT INTO "DailyActive" ("id", "userId", "dayNumber")
SELECT gen_random_uuid()::text, "id", FLOOR(EXTRACT(EPOCH FROM "createdAt") / 86400)::int
FROM "User"
ON CONFLICT DO NOTHING;
