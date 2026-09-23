import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface RaffleItemRow {
  id: string;
  name: string;
  rarity: string;
  supply: number;
  minted: number;
}

interface RaffleRow {
  id: string;
  itemName: string;
  endsAt: string;
  drawnAt: string | null;
  totalTickets: number;
  winner: string | null;
}

interface OwnerRaffle {
  items: RaffleItemRow[];
  raffles: RaffleRow[];
  ticketsInWindow: number;
  ticketHolders: number;
}

/**
 * Розыгрыши генезис-коллекции: объявить и провести тираж.
 *
 * Тираж проводится рукой владельца, а не таймером: итоги в тот же час
 * уходят постом в каналы, и пост с живым победителем — половина смысла
 * всей затеи. Автомат разыграл бы вещь в четыре утра в пустоту.
 */
export function RafflePanel({ token }: { token: string | null }) {
  const [data, setData] = useState<OwnerRaffle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemId, setItemId] = useState('');
  const [lastDraw, setLastDraw] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) {
      return;
    }

    apiFetch<{ raffle: OwnerRaffle }>('/api/admin/raffle', token)
      .then((payload) => {
        setData(payload.raffle);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Ошибка сети'),
      );
  }, [token]);

  useEffect(load, [load]);

  const running = data?.raffles.find((raffle) => raffle.drawnAt === null) ?? null;

  const create = () => {
    if (!token || !itemId || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    apiFetch('/api/admin/raffle', token, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    })
      .then(() => {
        setItemId('');
        load();
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Ошибка сети'),
      )
      .finally(() => setBusy(false));
  };

  const draw = () => {
    if (!token || !running || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    apiFetch<{ draw: { winner: { name: string }; itemName: string; serial: number; totalTickets: number } }>(
      `/api/admin/raffle/${running.id}/draw`,
      token,
      { method: 'POST' },
    )
      .then((payload) => {
        setLastDraw(
          `${payload.draw.winner.name} — «${payload.draw.itemName}» № ${payload.draw.serial}, билетов в тираже: ${payload.draw.totalTickets}`,
        );
        load();
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Ошибка сети'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
        Розыгрыши
      </h3>
      <div className="rounded-lg border border-don-edge bg-don-ink/80 p-3 text-left">
        {!data ? (
          <p className="text-xs text-neutral-400">…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-neutral-400">
              Билетов в текущем тираже: {data.ticketsInWindow} у {data.ticketHolders} игроков
            </p>

            {running ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-don-bone">
                  Идёт розыгрыш: «{running.itemName}» · тираж обещан до{' '}
                  {new Date(running.endsAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={draw}
                  className="min-h-11 w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
                >
                  {busy ? 'Тянем билет…' : 'Провести тираж'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <select
                  value={itemId}
                  onChange={(event) => setItemId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-don-edge bg-don-black px-3 text-sm text-don-bone"
                >
                  <option value="">Что разыграть…</option>
                  {data.items
                    .filter((item) => item.minted < item.supply)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · осталось {item.supply - item.minted} из {item.supply}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !itemId}
                  onClick={create}
                  className="min-h-11 w-full rounded-lg border border-don-gold/40 px-4 py-2 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
                >
                  Объявить розыгрыш
                </button>
              </div>
            )}

            {lastDraw && <p className="text-xs text-don-gold-soft">Тираж проведён: {lastDraw}</p>}
            {error && <p className="text-xs text-don-blood-light">{error}</p>}

            {data.raffles.some((raffle) => raffle.drawnAt !== null) && (
              <div className="border-t border-don-edge pt-2">
                <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
                  Прошлые тиражи
                </p>
                {data.raffles
                  .filter((raffle) => raffle.drawnAt !== null)
                  .map((raffle) => (
                    <p key={raffle.id} className="mt-1 text-xs text-neutral-400">
                      «{raffle.itemName}» — {raffle.winner ?? '—'} · билетов {raffle.totalTickets}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
