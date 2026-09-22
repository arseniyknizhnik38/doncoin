import { useState } from 'react';
import type { RetirementApi } from './useRetirement';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Уход на покой.
 *
 * Действие необратимое — обнуляет баланс, улучшения и бизнесы, — поэтому
 * живёт в настройках, а не на главном экране, и требует второго нажатия.
 * Случайно уйти на покой нельзя.
 */
export function RetirementCard({ api }: { api: RetirementApi }) {
  const [confirming, setConfirming] = useState(false);
  const state = api.retirement;

  if (!state) {
    return null;
  }

  return (
    <div className="rounded-lg border border-don-blood/50 bg-don-ink/80 p-4 text-left">
      <p className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase">
        Уход на покой
      </p>

      {state.count > 0 && (
        <p className="mt-1 text-sm text-don-gold-soft">
          {state.title} · +{state.bonus}% к доходу навсегда
        </p>
      )}

      {state.available ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Вы прошли путь до конца. Можно отойти от дел и начать заново: баланс,
            улучшения и бизнесы обнулятся, но доход навсегда вырастет до{' '}
            <span className="text-don-gold-soft">+{state.nextBonus}%</span>. Respect,
            перки, клан и друзья останутся при вас.
          </p>

          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400"
              >
                Передумал
              </button>
              <button
                type="button"
                disabled={api.retiring}
                onClick={() => {
                  api.retire();
                  setConfirming(false);
                }}
                className="flex-1 rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-2.5 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
              >
                {api.retiring ? 'Уходим…' : 'Точно ухожу'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 w-full rounded-lg border border-don-gold/40 px-4 py-2.5 text-sm font-semibold text-don-gold active:scale-95"
            >
              Отойти от дел
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Откроется на последней ступени. Осталось заработать{' '}
          <span className="text-neutral-300">{formatCoins(state.remaining)}</span> DONC.
          Тогда можно будет начать заново — и каждый круг будет короче
          предыдущего.
        </p>
      )}

      {api.error && (
        <p className="mt-2 text-xs tracking-wider text-don-blood-light">{api.error}</p>
      )}
    </div>
  );
}
