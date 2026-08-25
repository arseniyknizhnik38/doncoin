-- Respect: медленная репутационная валюта.
-- respectProgress хранит незавершённый остаток тапов до следующей единицы,
-- чтобы начисление не зависело от того, каким размером пачки пришли тапы.

ALTER TABLE "User" ADD COLUMN "respect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "respectProgress" INTEGER NOT NULL DEFAULT 0;
