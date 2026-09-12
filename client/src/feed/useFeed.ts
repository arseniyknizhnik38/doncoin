import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface FeedEvent {
  id: string;
  kind: string;
  text: string;
  /** Про семью или про человека — оформляются по-разному. */
  aboutClan: boolean;
  createdAt: string;
}

export interface FeedApi {
  events: FeedEvent[] | null;
  loading: boolean;
}

/**
 * Лента «Что слышно».
 *
 * Перезапрашивается при открытии вкладки, а не по таймеру: новости здесь
 * появляются раз в час-другой, и опрашивать сервер чаще незачем.
 */
export function useFeed(token: string | null, refreshKey: number): FeedApi {
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ events: FeedEvent[] }>('/api/feed', token)
      .then((payload) => {
        if (!cancelled) {
          setEvents(payload.events);
        }
      })
      .catch(() => {
        // Молча: лента — украшение, ошибка ради неё не должна портить экран.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  return { events, loading };
}
