import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notificationsBlocked: boolean;
}

export interface SettingsApi {
  settings: NotificationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setNotifications: (enabled: boolean) => void;
}

/** Настройки читаем только когда панель открыта. */
export function useSettings(token: string | null, enabled: boolean): SettingsApi {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ notifications: NotificationSettings }>('/api/settings', token)
      .then((payload) => {
        if (!cancelled) {
          setSettings(payload.notifications);
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
  }, [token, enabled]);

  const setNotifications = useCallback(
    (value: boolean) => {
      if (!token || saving) {
        return;
      }

      setSaving(true);

      apiFetch<{ notifications: NotificationSettings }>('/api/settings', token, {
        method: 'PATCH',
        body: JSON.stringify({ notificationsEnabled: value }),
      })
        .then((payload) => {
          setSettings(payload.notifications);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setSaving(false));
    },
    [token, saving],
  );

  return { settings, loading, saving, error, setNotifications };
}
