import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Combination {
  combination: { id: string; emoji: string; title: string }[];
}

interface OwnerOmerta {
  today: Combination & { solved: number };
  tomorrow: Combination;
}

/**
 * Ответ Шифра Омерты для владельца.
 *
 * Комбинация складывается сама, но свой канал должен выкладывать её первым —
 * поэтому видно и сегодняшнюю, и завтрашнюю, чтобы пост готовился заранее.
 */
export function OmertaPanel({ token }: { token: string | null }) {
  const [data, setData] = useState<OwnerOmerta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    apiFetch<{ omerta: OwnerOmerta }>('/api/admin/omerta', token)
      .then((payload) => !cancelled && setData(payload.omerta))
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Ошибка сети');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const line = (entry: Combination) => (
    <>
      <p className="text-2xl tracking-[0.3em]">{entry.combination.map((item) => item.emoji).join('')}</p>
      <p className="text-[11px] text-neutral-400">
        {entry.combination.map((item) => item.title).join(' → ')}
      </p>
    </>
  );

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
        Шифр Омерты
      </h3>
      <div className="rounded-lg border border-don-edge bg-don-ink/80 p-3 text-left">
        {error ? (
          <p className="text-xs text-don-blood-light">{error}</p>
        ) : !data ? (
          <p className="text-xs text-neutral-400">…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
                Сегодня · разгадали {data.today.solved}
              </p>
              {line(data.today)}
            </div>
            <div>
              <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">Завтра</p>
              {line(data.tomorrow)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
