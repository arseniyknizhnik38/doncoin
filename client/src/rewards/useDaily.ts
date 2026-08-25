import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { DailyStatus } from './types';

export interface DailyApi {
  status: DailyStatus | null;
  claiming: boolean;
  /** Сколько начислил последний успешный клик — для всплывашки. */
  justClaimed: string | null;
  error: string | null;
  claim: () => void;
}

/**
 * Ежедневный бонус. Начальный статус приходит вместе с ответом на вход,
 * поэтому лишнего запроса при старте нет.
 */
export function useDaily(
  token: string | null,
  initialStatus: DailyStatus | null,
  onStateChange: (state: GameState) => void,
): DailyApi {
  const [status, setStatus] = useState<DailyStatus | null>(initialStatus);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const claim = useCallback(() => {
    if (!token || claiming || !status?.available) {
      return;
    }

    setClaiming(true);

    apiFetch<{ reward: string; daily: DailyStatus; state: GameState }>(
      '/api/daily/claim',
      token,
      { method: 'POST' },
    )
      .then((payload) => {
        setStatus(payload.daily);
        onStateChange(payload.state);
        setJustClaimed(payload.reward);
        setError(null);
        window.setTimeout(() => setJustClaimed(null), 3000);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Ошибка сети');
      })
      .finally(() => setClaiming(false));
  }, [token, claiming, status, onStateChange]);

  return { status, claiming, justClaimed, error, claim };
}
