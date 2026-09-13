import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface AdView {
  id: string;
  advertiser: string | null;
  title: string;
  channelName: string;
  channelUrl: string;
  channelChatId: string;
  rewardDonc: string;
  rewardHours: number | null;
  familyXpReward: number;
  startsAt: string | null;
  endsAt: string | null;
  slots: number | null;
  completedCount: number;
  sortOrder: number;
  status: string;
  statusTitle: string;
}

/** Что отправляем при заведении кампании. */
export interface AdDraft {
  advertiser: string;
  title: string;
  channelName: string;
  channelUrl: string;
  channelChatId: string;
  rewardDonc: number;
  rewardHours: number | null;
  slots: number | null;
  endsAt: string | null;
}

export interface AdsApi {
  ads: AdView[] | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  create: (draft: AdDraft) => Promise<boolean>;
  stop: (id: string) => void;
  reload: () => void;
  /** Итог «Проверить бота» по кампаниям. */
  diagnoses: Record<string, Diagnosis | 'checking'>;
  diagnose: (id: string) => void;
}

export interface Diagnosis {
  ok: boolean;
  message: string;
}

/**
 * Рекламные кампании в админке. Запрашиваются только при открытой панели:
 * владелец заходит сюда редко, держать их в памяти незачем.
 */
export function useAds(token: string | null, enabled: boolean): AdsApi {
  const [ads, setAds] = useState<AdView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ ads: AdView[] }>('/api/admin/ads', token)
      .then((payload) => {
        if (!cancelled) {
          setAds(payload.ads);
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

  const create = useCallback(
    async (draft: AdDraft): Promise<boolean> => {
      if (!token || saving) {
        return false;
      }

      setSaving(true);

      try {
        await apiFetch('/api/admin/ads', token, {
          method: 'POST',
          body: JSON.stringify(draft),
        });
        setError(null);
        reload();

        return true;
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Ошибка сети');

        return false;
      } finally {
        setSaving(false);
      }
    },
    [token, saving, reload],
  );

  const stop = useCallback(
    (id: string) => {
      if (!token) {
        return;
      }

      apiFetch(`/api/admin/ads/${id}/stop`, token, { method: 'POST' })
        .then(() => reload())
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        });
    },
    [token, reload],
  );

  const [diagnoses, setDiagnoses] = useState<AdsApi['diagnoses']>({});

  const diagnose = useCallback(
    (id: string) => {
      if (!token) {
        return;
      }

      setDiagnoses((prev) => ({ ...prev, [id]: 'checking' }));

      apiFetch<{ diagnosis: Diagnosis }>(`/api/admin/ads/${id}/diagnose`, token, {
        method: 'POST',
      })
        .then((payload) => setDiagnoses((prev) => ({ ...prev, [id]: payload.diagnosis })))
        .catch((cause: unknown) =>
          setDiagnoses((prev) => ({
            ...prev,
            [id]: { ok: false, message: cause instanceof Error ? cause.message : 'Ошибка сети' },
          })),
        );
    },
    [token],
  );

  return { ads, loading, saving, error, create, stop, reload, diagnoses, diagnose };
}
