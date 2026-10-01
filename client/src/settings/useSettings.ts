import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import type { Lang } from '../i18n';

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notificationsBlocked: boolean;
}

interface SettingsPayload {
  notifications: NotificationSettings;
  language?: string;
}

export interface SettingsApi {
  settings: NotificationSettings | null;
  /** Язык, записанный на сервере; null — пока не загрузился. */
  language: Lang | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setNotifications: (enabled: boolean) => void;
  setLanguage: (lang: Lang) => void;
}

function parseLang(value: string | undefined): Lang | null {
  return value === 'ru' || value === 'en' || value === 'zh' ? value : null;
}

/** Настройки читаем только когда панель открыта. */
export function useSettings(token: string | null, enabled: boolean): SettingsApi {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [language, setLanguageState] = useState<Lang | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !enabled) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<SettingsPayload>('/api/settings', token)
      .then((payload) => {
        if (!cancelled) {
          setSettings(payload.notifications);
          setLanguageState(parseLang(payload.language));
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

      apiFetch<SettingsPayload>('/api/settings', token, {
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

  const setLanguage = useCallback(
    (lang: Lang) => {
      if (!token || saving) {
        return;
      }

      // Экран переключается сразу (через onLangChange в панели), а сервер
      // догоняет следом — чтобы выбор пережил перезаход.
      setSaving(true);
      setLanguageState(lang);

      apiFetch<SettingsPayload>('/api/settings', token, {
        method: 'PATCH',
        body: JSON.stringify({ language: lang }),
      })
        .then((payload) => {
          setLanguageState(parseLang(payload.language) ?? lang);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        })
        .finally(() => setSaving(false));
    },
    [token, saving],
  );

  return { settings, language, loading, saving, error, setNotifications, setLanguage };
}
