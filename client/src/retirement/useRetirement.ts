import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';

export interface RetirementState {
  /** Сколько кругов уже пройдено. */
  count: number;
  /** Текущая постоянная прибавка к доходу, в процентах. */
  bonus: number;
  /** Какой она станет после следующего ухода. */
  nextBonus: number;
  available: boolean;
  /** Сколько ещё нужно заработать, чтобы уйти. */
  remaining: string;
  title: string | null;
}

export interface RetirementApi {
  retirement: RetirementState | null;
  retiring: boolean;
  error: string | null;
  retire: () => void;
}

/**
 * Уход на покой. Запрашивается только при открытых настройках: событие
 * редкое, держать его в памяти всё время незачем.
 */
export function useRetirement(
  token: string | null,
  enabled: boolean,
  onStateChange: (state: GameState) => void,
): RetirementApi {
  const [retirement, setRetirement] = useState<RetirementState | null>(null);
  const [retiring, setRetiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;

    apiFetch<{ retirement: RetirementState }>('/api/retirement', token)
      .then((payload) => {
        if (!cancelled) {
          setRetirement(payload.retirement);
        }
      })
      .catch(() => {
        // Молча: это дополнительный блок в настройках, а не основной экран.
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  const retire = useCallback(() => {
    if (!token || retiring) {
      return;
    }

    setRetiring(true);

    apiFetch<{ retirement: RetirementState; state: GameState }>('/api/retirement', token, {
      method: 'POST',
    })
      .then((payload) => {
        setRetirement(payload.retirement);
        onStateChange(payload.state);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Ошибка сети');
      })
      .finally(() => setRetiring(false));
  }, [token, retiring, onStateChange]);

  return { retirement, retiring, error, retire };
}
