/**
 * Бустеры — то, ради чего игрок заходит несколько раз в день.
 *
 * Заряды бесплатные и обнуляются каждые сутки: три захода в день получаются
 * не потому, что игру просят об этом словами, а потому, что иначе заряды
 * сгорают. Это же — очевидная точка будущей монетизации: докупать заряды
 * за Telegram Stars, ничего не ломая в балансе.
 */

export type BoosterId = 'full_energy' | 'rush';

export interface BoosterDefinition {
  id: BoosterId;
  title: string;
  description: string;
  /** Сколько бесплатных зарядов в сутки. */
  perDay: number;
  /** Поле счётчика в строке игрока. */
  usedField: 'fullEnergyUsed' | 'rushUsed';
}

/** Во сколько раз «Разгон» умножает монеты за тап. */
export const RUSH_MULTIPLIER = 5;

/** Сколько секунд длится «Разгон». */
export const RUSH_SECONDS = 20;

export const BOOSTERS: readonly BoosterDefinition[] = [
  {
    id: 'full_energy',
    title: 'Полная обойма',
    description: 'Мгновенно заполнить обойму',
    perDay: 3,
    usedField: 'fullEnergyUsed',
  },
  {
    id: 'rush',
    title: 'Разгон',
    description: `×${RUSH_MULTIPLIER} за тап на ${RUSH_SECONDS} секунд`,
    perDay: 3,
    usedField: 'rushUsed',
  },
];

export function findBooster(id: string): BoosterDefinition | undefined {
  return BOOSTERS.find((booster) => booster.id === id);
}

export interface BoosterView {
  id: BoosterId;
  title: string;
  description: string;
  left: number;
  perDay: number;
  /** Для «Разгона» — сколько секунд он ещё действует. */
  activeSeconds: number;
}

interface BoosterUser {
  boostDay: number;
  fullEnergyUsed: number;
  rushUsed: number;
  rushEndsAt: Date | null;
}

/**
 * Счётчики за сегодня. Если последняя трата была в другие сутки, они уже
 * обнулены — просто не записаны в базу, и записывать их заранее не нужно:
 * отдельная фоновая задача ради сброса не окупается.
 */
export function usedToday(user: BoosterUser, today: number): Record<BoosterId, number> {
  const stale = user.boostDay !== today;

  return {
    full_energy: stale ? 0 : user.fullEnergyUsed,
    rush: stale ? 0 : user.rushUsed,
  };
}

export function describeBoosters(
  user: BoosterUser,
  today: number,
  now: Date,
): BoosterView[] {
  const used = usedToday(user, today);
  const rushLeftMs = user.rushEndsAt ? user.rushEndsAt.getTime() - now.getTime() : 0;

  return BOOSTERS.map((booster) => ({
    id: booster.id,
    title: booster.title,
    description: booster.description,
    left: Math.max(0, booster.perDay - used[booster.id]),
    perDay: booster.perDay,
    activeSeconds:
      booster.id === 'rush' && rushLeftMs > 0 ? Math.ceil(rushLeftMs / 1000) : 0,
  }));
}
