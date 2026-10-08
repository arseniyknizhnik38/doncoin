import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface AdSourceRow {
  source: string;
  placement: string | null;
  players: number;
  converted: number;
  d1: number;
  d3: number;
  d7: number;
  eligibleD3: number;
  conversionPercent: number | null;
  d3Percent: number | null;
}

export interface AdRejectionRow {
  reason: string;
  status: string;
  count: number;
}

export interface AdSourcesView {
  days: number;
  sources: AdSourceRow[];
  rejections: AdRejectionRow[];
}

export interface AdSourcesApi {
  data: AdSourcesView | null;
  loading: boolean;
}

/**
 * Отчёт по закупке. Отдельным запросом от общей сводки: таблица считает
 * возвраты по каждой площадке и нужна только в дни закупки, а сводку
 * открывают каждый день.
 */
export function useAdSources(token: string | null, enabled: boolean): AdSourcesApi {
  const [data, setData] = useState<AdSourcesView | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<AdSourcesView>('/api/admin/sources', token)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch(() => {
        // Молча: отчёт по закупке — дополнение к сводке, а не её основа.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  return { data, loading };
}
