/**
 * Симуляция прогресса игрока на реальном конфиге.
 *
 * Экономику этой игры невозможно свести в голове: доход компаундится сразу
 * по четырём веткам, и ошибка в третьем знаке множителя превращает два
 * месяца игры в две недели. Поэтому баланс правится так: поменяли число в
 * конфиге — прогнали этот скрипт — посмотрели, куда уехали сроки.
 *
 *   npx tsx scripts/simulate-progress.ts
 */
import {
  BUSINESS_CATALOG,
  COLLECT_CAP_HOURS,
  levelCost,
  levelIncome,
  requiredRankStep,
} from '../src/config/businesses.js';
import { RANKS, rankStep } from '../src/config/ranks.js';
import { ENERGY_PER_TAP } from '../src/lib/energy.js';
import { UPGRADES } from '../src/lib/upgrades.js';

/** Портрет игрока: сколько раз в день заходит и сколько часов бодрствует. */
interface Player {
  name: string;
  sessions: number;
  wakingHours: number;
}

const PLAYERS: readonly Player[] = [
  { name: 'казуал', sessions: 3, wakingHours: 10 },
  { name: 'средний', sessions: 5, wakingHours: 14 },
  { name: 'активный', sessions: 8, wakingHours: 16 },
];

const [TAP, ENERGY, REGEN] = UPGRADES;

const coinsPerTap = (level: number) => TAP!.valueAt(level).coinsPerTap!;
const energyMax = (level: number) => ENERGY!.valueAt(level).energyMax!;
const energyPerSecond = (level: number) => REGEN!.valueAt(level).energyPerSecond!;

/**
 * Сколько часов дохода бизнесов игрок реально забирает за сутки: касса
 * копит не больше COLLECT_CAP_HOURS, всё сверх — простой.
 */
function collectedHours({ sessions, wakingHours }: Player): number {
  const gap = wakingHours / sessions;
  const night = 24 - wakingHours;

  return (
    (sessions - 1) * Math.min(gap, COLLECT_CAP_HOURS) +
    Math.min(night + gap, COLLECT_CAP_HOURS)
  );
}

interface Result {
  /** День, на который взята каждая ступень ранга. */
  reached: (number | null)[];
  /** Доля пассивного дохода в общем заработке. */
  passiveShare: number;
}

function simulate(player: Player, days = 400): Result {
  let balance = 0;
  let earned = 0;
  let active = 0;
  let passive = 0;
  const levels = { tap: 0, energy: 0, regen: 0 };
  const owned = BUSINESS_CATALOG.map(() => 0);
  const reached: (number | null)[] = RANKS.map(() => null);
  const businessHours = collectedHours(player);

  for (let day = 1; day <= days; day += 1) {
    const perTap = coinsPerTap(levels.tap);
    const tapsPerHour = (energyPerSecond(levels.regen) * 3600) / ENERGY_PER_TAP;
    // За день игрок успевает либо всё, что восстановилось, либо столько
    // обойм, сколько раз зашёл, — что меньше.
    const taps = Math.min(
      tapsPerHour * player.wakingHours,
      player.sessions * (energyMax(levels.energy) / ENERGY_PER_TAP),
    );
    const hourly = tapsPerHour * perTap;

    // Ежедневный бонус и задания дают примерно три часа дохода — считаем их
    // активным заработком: без захода в игру их не получить.
    const activeToday = taps * perTap + hourly * 0.25 * Math.min(day, 30) + hourly * 3;
    const businessPerHour = owned.reduce(
      (sum, level, index) => sum + Number(levelIncome(BUSINESS_CATALOG[index]!, level)),
      0,
    );
    const passiveToday = businessPerHour * businessHours + hourly * 0.15 * 8;

    balance += activeToday + passiveToday;
    earned += activeToday + passiveToday;
    active += activeToday;
    passive += passiveToday;

    // Игрок покупает то, что окупается быстрее всего, пока хватает денег.
    for (let guard = 0; guard < 1000; guard += 1) {
      const step = rankStep(BigInt(Math.floor(earned)));
      const options: { buy: () => void; price: number; gain: number }[] = [
        {
          buy: () => { levels.tap += 1; },
          price: Number(TAP!.price(levels.tap)),
          gain: (taps * perTap * 0.18) / 24,
        },
        {
          buy: () => { levels.regen += 1; },
          price: Number(REGEN!.price(levels.regen)),
          gain: ((3600 / ENERGY_PER_TAP) * perTap * player.wakingHours) / 24,
        },
        {
          buy: () => { levels.energy += 1; },
          price: Number(ENERGY!.price(levels.energy)),
          gain: (100 * perTap * player.sessions) / 24,
        },
      ];

      BUSINESS_CATALOG.forEach((business, index) => {
        if (step < requiredRankStep(business.slug)) {
          return;
        }

        options.push({
          buy: () => { owned[index] += 1; },
          price: Number(levelCost(business, owned[index]!)),
          gain: (Number(business.baseIncomePerHour) * businessHours) / 24,
        });
      });

      const best = options
        .filter((option) => option.price <= balance)
        .sort((a, b) => a.price / a.gain - b.price / b.gain)[0];

      if (!best) {
        break;
      }

      balance -= best.price;
      best.buy();
    }

    const step = rankStep(BigInt(Math.floor(earned)));

    for (let i = 0; i <= step; i += 1) {
      reached[i] ??= day;
    }
  }

  return { reached, passiveShare: passive / (active + passive) };
}

const results = PLAYERS.map((player) => ({ player, result: simulate(player) }));

console.log('Ступень              порог DONC        ' + PLAYERS.map((p) => p.name.padStart(9)).join(''));

RANKS.forEach((rank, index) => {
  const label = `${rank.title} ${'★'.repeat(rank.star)}`.padEnd(20);
  const threshold = rank.minBalance.toLocaleString('ru-RU').padStart(16);
  const days = results
    .map(({ result }) => String(result.reached[index] ?? '—').padStart(9))
    .join('');

  console.log(`${label}${threshold}  ${days}`);
});

console.log('\nДоля пассивного дохода:');
results.forEach(({ player, result }) => {
  console.log(`  ${player.name.padEnd(10)} ${(result.passiveShare * 100).toFixed(0)}%`);
});
