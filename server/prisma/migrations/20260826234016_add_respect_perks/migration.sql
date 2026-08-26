-- Траты Respect на постоянные прибавки к доходу.
-- Сам respect не уменьшается: он отражает вложенный труд. Расход учитывается
-- отдельным полем respectSpent, а доступный остаток = respect - respectSpent.

ALTER TABLE "User" ADD COLUMN "respectSpent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "respectStreetLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "respectBusinessLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "respectFamilyLevel" INTEGER NOT NULL DEFAULT 0;
