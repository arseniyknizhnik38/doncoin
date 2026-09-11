-- Ребаланс экономики: энергия теперь хранится в долях тапа
-- (1 тап = 10 единиц, см. server/src/lib/energy.ts), а стартовый доход
-- за тап поднят с 1 до 10.
--
-- Старые значения по умолчанию давали обойму в 100 тапов и полное
-- восстановление за 17 минут — игра выжималась досуха за полторы недели.

ALTER TABLE "User" ALTER COLUMN "energy" SET DEFAULT 6000;
ALTER TABLE "User" ALTER COLUMN "energyMax" SET DEFAULT 6000;
ALTER TABLE "User" ALTER COLUMN "coinsPerTap" SET DEFAULT 10;

-- Игроки, зарегистрированные до ребаланса, стоят на старых числах: их
-- уровни улучшений остаются, а рабочие значения пересчитываются по новым
-- формулам из lib/upgrades.ts.
UPDATE "User"
SET
  "energyMax" = (600 + 100 * "energyLevel") * 10,
  "energy" = LEAST("energy" * 10, (600 + 100 * "energyLevel") * 10),
  "energyPerSecond" = 1 + "regenLevel",
  "coinsPerTap" = ROUND(10 * POWER(1.18, "tapLevel"))::int;
