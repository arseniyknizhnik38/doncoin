import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { AdminStats } from './types';

export interface AdminStatsApi {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Сводка запрашивается только когда панель открыта — лишних запросов нет. */
export function useAdminStats(token: string | null, enabled: boolean): AdminStatsApi {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<AdminStats>('/api/admin/stats', token)
      .then((payload) => {
        if (!cancelled) {
          setStats(payload);
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
  }, [token, enabled, retry]);

  return { stats, loading, error, reload };
}
