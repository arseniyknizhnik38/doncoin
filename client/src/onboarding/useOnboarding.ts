import { useCallback, useState } from 'react';

const STORAGE_KEY = 'doncoin:onboarding-seen';

/** Ниже этого заработка игрок считается новичком. Первая звезда — 8 000. */
const NEWCOMER_EARNED = 5_000;

function seen(): boolean {
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
  const visible = !dismissed && newcomer && !seen();

  return { visible, dismiss };
}
