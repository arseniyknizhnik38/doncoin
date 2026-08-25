-- Уровни улучшений. Рабочие параметры (coinsPerTap, energyMax,
-- energyPerSecond) остаются отдельными колонками и пересчитываются при
-- покупке — так формула живёт только в коде, а игровой SQL их просто читает.

ALTER TABLE "User" ADD COLUMN "tapLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "energyLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "regenLevel" INTEGER NOT NULL DEFAULT 0;
