-- Оффлайн-доход и ежедневный бонус.
-- lastSeenAt существующим игрокам ставим «сейчас», иначе им начислился бы
-- доход за всё время с регистрации.

ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "dailyStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastDailyAt" TIMESTAMP(3);
