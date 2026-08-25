import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { GameState } from '../game/types';
import type { BusinessIncome, BusinessView } from './types';

export interface BusinessesApi {
  businesses: BusinessView[] | null;
  income: BusinessIncome | null;
  loading: boolean;
  buying: string | null;
  error: string | null;
  buy: (id: string) => void;
  reload: () => void;
}

interface BusinessesResponse {
  businesses: BusinessView[];
  income: BusinessIncome;
  state?: GameState;
}

export function useBusinesses(
  token: string | null,
  /** Меняется при открытии вкладки — заставляет перезапросить данные. */
  refreshKey = 0,
  onStateChange: (state: GameState) => void = () => {},
): BusinessesApi {
  const [businesses, setBusinesses] = useState<BusinessView[] | null>(null);
  const [income, setIncome] = useState<BusinessIncome | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<BusinessesResponse>('/api/businesses', token)
      .then((payload) => {
        if (!cancelled) {
          setBusinesses(payload.businesses);
          setIncome(payload.income);
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

  const buy = useCallback(
    (id: string) => {
      if (!token || buying) {
        return;
      }

      setBuying(id);

      apiFetch<BusinessesResponse>(`/api/businesses/${id}/buy`, token, { method: 'POST' })
        .then((payload) => {
          setBusinesses(payload.businesses);
          setIncome(payload.income);

          if (payload.state) {
            onStateChange(payload.state);
          }

          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setBuying(null));
    },
    [token, buying, onStateChange],
  );

  return { businesses, income, loading, buying, error, buy, reload };
}
