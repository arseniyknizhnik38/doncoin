import { utcDayNumber } from '../config/rewards.js';
import { prisma } from './prisma.js';

/**
 * Отмечает, что игрок заходил сегодня.
 *
 * Пишет не чаще раза в сутки на игрока: если прошлый визит был в те же
 * сутки, до базы дело не доходит. Вход случается несколько раз в день, а
 * лишняя запись на каждый — это лишний round-trip до Neon, который стоит
 * сотни миллисекунд на горячем пути.
 *
 * Ошибку глотаем намеренно: это статистика. Игрок не должен получить отказ
 * входа из-за того, что не записалась метка посещения.
 */
export async function recordActiveDay(
  userId: string,
  previousSeenAt: Date,
  now: Date,
  /**
   * Игрок только что зарегистрирован. У него lastSeenAt уже равен «сейчас»,
   * и обычная проверка решила бы, что он сегодня уже отмечен, — день
   * регистрации выпал бы из истории, а с ним и нулевой день каждой когорты.
   */
  isNew = false,
): Promise<void> {
  const today = utcDayNumber(now);

  if (!isNew && utcDayNumber(previousSeenAt) === today) {
    return;
  }

  try {
    await prisma.dailyActive.create({ data: { userId, dayNumber: today } });
  } catch (error) {
    // P2002 — два входа одновременно, метка уже стоит. Остальное логируем,
    // но наружу не отдаём.
    if ((error as { code?: string }).code !== 'P2002') {
      console.warn('[activity] не записали посещение', error);
    }
  }
}
