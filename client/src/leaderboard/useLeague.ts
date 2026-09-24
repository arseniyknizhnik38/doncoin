import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface LeagueState {
  tier: number;
  tierTitle: string;
  tiersTotal: number;
  endsAt: string;
  promoteCount: number;
  demoteCount: number;
  lastOutcome: 'up' | 'stay' | 'down' | null;
  myPlace: number;
  standings: { name: string; earned: string; isMe: boolean }[];
}

export interface LeagueApi {
  league: LeagueState | null;
  loading: boolean;
}

/**
 * Личная лига игрока.
 *
 * Перезапрашивается вместе с топом (общий ключ вкладки): таблица группы
 * живёт неделю, но соседи зарабатывают прямо сейчас, и каждое открытие
 * вкладки должно показывать свежий счёт.
 */
export function useLeague(token: string | null, refreshKey: number): LeagueApi {
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    apiFetch<{ league: LeagueState | null }>('/api/league', token)
      .then((payload) => {
        if (!cancelled) {
          setLeague(payload.league);
        }
      })
      .catch(() => {
        // Молча: лига — дополнение к топу, а не его основа.
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  return { league, loading };
}
