import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface CipherView {
  dayNumber: number;
  /** Смещение в сутках от сегодняшних: 0 — сегодня, 1 — завтра. */
  day: number;
  code: string;
  hint: string | null;
  /** Сколько игроков разгадало — прямая мера того, доходят ли до канала. */
  solves: number;
}

export interface CiphersApi {
  ciphers: CipherView[] | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (day: number, code: string, hint: string) => Promise<boolean>;
  reload: () => void;
}

/**
 * Шифры дня в админке. Запрашиваются только при открытой панели: владелец
 * заходит сюда раз в день, держать список в памяти незачем.
 */
export function useCiphers(token: string | null, enabled: boolean): CiphersApi {
  const [ciphers, setCiphers] = useState<CipherView[] | null>(null);
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

    apiFetch<{ ciphers: CipherView[] }>('/api/admin/cipher', token)
      .then((payload) => {
        if (!cancelled) {
          setCiphers(payload.ciphers);
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

  const save = useCallback(
    async (day: number, code: string, hint: string): Promise<boolean> => {
      if (!token || saving) {
        return false;
      }

      setSaving(true);

      try {
        await apiFetch('/api/admin/cipher', token, {
          method: 'POST',
          body: JSON.stringify({ day, code, hint }),
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

  return { ciphers, loading, saving, error, save, reload };
}
