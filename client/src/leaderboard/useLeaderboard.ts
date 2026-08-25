import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { LeaderboardData } from './types';

export interface LeaderboardApi {
  data: LeaderboardData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useLeaderboard(
  token: string | null,
  /** Меняется при открытии вкладки — заставляет перезапросить данные. */
  refreshKey = 0,
): LeaderboardApi {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<LeaderboardData>('/api/leaderboard', token)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey, retry]);

  return { data, loading, error, reload };
}
