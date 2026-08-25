-- Накопленный доход: основа для рангов вместо текущего баланса.
-- Существующим игрокам проставляем текущий баланс — точнее данных нет,
-- а занижать их статус нельзя.

ALTER TABLE "User" ADD COLUMN "totalEarned" BIGINT NOT NULL DEFAULT 0;

UPDATE "User" SET "totalEarned" = "balance" WHERE "totalEarned" = 0;
