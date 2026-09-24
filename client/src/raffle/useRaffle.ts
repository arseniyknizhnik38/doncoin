import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

export interface RaffleItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  supply: number;
  minted: number;
}

export interface ActiveRaffle {
  id: string;
  endsAt: string;
  myTickets: number;
  totalTickets: number;
  item: RaffleItem;
}

export interface VaultEntry {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  rarity: RaffleItem['rarity'];
  serial: number;
  supply: number;
  wonAt: string;
}

export interface DrawHistoryEntry {
  id: string;
  itemName: string;
  icon: string;
  rarity: RaffleItem['rarity'];
  winner: string;
  totalTickets: number;
  drawnAt: string;
}

export interface RaffleState {
  /** Билеты игрока к ближайшему тиражу — копятся и между розыгрышами. */
  myTickets: number;
  active: ActiveRaffle | null;
  history: DrawHistoryEntry[];
  vault: VaultEntry[];
}

export interface RaffleApi {
  raffle: RaffleState | null;
  reload: () => void;
}

/**
 * Розыгрыш генезис-коллекции и сейф игрока.
 *
 * Запрашивается при входе; перезапрашивается после бонуса дня — это самый
 * частый источник билетов, и счётчик на карточке должен подрасти сразу,
 * а не при следующем заходе.
 */
export function useRaffle(token: string | null): RaffleApi {
  const [raffle, setRaffle] = useState<RaffleState | null>(null);

  const load = useCallback(() => {
    if (!token) {
      return;
    }

    apiFetch<{ raffle: RaffleState }>('/api/raffle', token)
      .then((payload) => setRaffle(payload.raffle))
      .catch(() => {
        // Молча: розыгрыш — дополнение к экрану заданий, а не его основа.
      });
  }, [token]);

  useEffect(load, [load]);

  return { raffle, reload: load };
}
