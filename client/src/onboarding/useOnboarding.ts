import { useCallback, useState } from 'react';

const STORAGE_KEY = 'doncoin:onboarding-seen';

/**
 * Ниже этого заработка игрок считается новичком.
 *
 * Порог обязан быть выше стартового бонуса приглашённого (10 000): друг,
 * пришедший по ссылке, рождается с бонусом на счету, и порог в 5 000 делал
 * его «бывалым» до первого тапа — обучение не показывалось именно тем, кого
 * привели за руку.
 */
const NEWCOMER_EARNED = 15_000;

/** Смотрел ли игрок обучение. Экспорт — для предзагрузки лент Бобби. */
export function seenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Приватный режим или заблокированное хранилище: лучше показать
    // объяснение лишний раз, чем не показать вовсе.
    return false;
  }
}

/**
 * Показывать ли объяснение игры.
 *
 * Одного флага `isNew` с сервера мало: он приходит только при самом первом
 * входе, и человек, закрывший приложение на втором экране, больше никогда
 * не увидел бы подсказок. Поэтому решает пара «не смотрел раньше» и «ещё
 * ничего не заработал».
 */
export function useOnboarding(isNew: boolean, totalEarned: string | null) {
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => {
    setDismissed(true);

    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Не записалось — покажем ещё раз при следующем входе. Не страшно.
    }
  }, []);

  const newcomer = isNew || (totalEarned !== null && Number(totalEarned) < NEWCOMER_EARNED);
  const visible = !dismissed && newcomer && !seenOnboarding();

  return { visible, dismiss };
}
