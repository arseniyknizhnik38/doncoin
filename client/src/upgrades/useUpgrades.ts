import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../game/types';
import type { UpgradeView } from './types';

export interface UpgradesApi {
  upgrades: UpgradeView[] | null;
  loading: boolean;
  /** id улучшения, которое сейчас покупается. */
  buying: string | null;
  error: string | null;
  buy: (id: string) => void;
}

/**
 * Каталог улучшений и покупка. Ответ сервера содержит и новое игровое
 * состояние — отдаём его в useGame, чтобы баланс и параметры на экране
 * игры обновились сразу после покупки.
 */
export function useUpgrades(
  initDataRaw: string | undefined,
  onStateChange: (state: GameState) => void,
): UpgradesApi {
  const [upgrades, setUpgrades] = useState<UpgradeView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initDataRaw) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch('/api/upgrades', {
      headers: { Authorization: `tma ${initDataRaw}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? `Ошибка ${response.status}`);
        }

        setUpgrades(payload.upgrades as UpgradeView[]);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [initDataRaw]);

  const buy = useCallback(
    (id: string) => {
      if (!initDataRaw || buying) {
        return;
      }

      setBuying(id);

      fetch(`/api/upgrades/${id}/buy`, {
        method: 'POST',
        headers: { Authorization: `tma ${initDataRaw}` },
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(payload?.error ?? `Ошибка ${response.status}`);
          }

          setUpgrades(payload.upgrades as UpgradeView[]);
          onStateChange(payload.state as GameState);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setBuying(null));
    },
    [initDataRaw, buying, onStateChange],
  );

  return { upgrades, loading, buying, error, buy };
}
