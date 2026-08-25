import { useCallback, useEffect, useState } from 'react';
import type { ReferralsData } from './types';

export interface ReferralsState {
  data: ReferralsData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useReferrals(token: string | null): ReferralsState {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch('/api/referrals', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error ?? `Ошибка ${response.status}`);
        }

        setData(payload as ReferralsData);
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
  }, [token, attempt]);

  return { data, loading, error, reload };
}
