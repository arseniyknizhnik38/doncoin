import type { GameState } from '../game/types';
import { PixelIcon } from '../ui/PixelIcon';
import { ErrorState, SkeletonList } from '../ui/States';
import type { BusinessesApi } from './useBusinesses';

interface BusinessListProps {
  api: BusinessesApi;
  state: GameState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');


export function BusinessList({ api, state }: BusinessListProps) {
  const { businesses, income, loading, buying, error } = api;

  if (!businesses) {
    return loading ? (
      <SkeletonList rows={4} />
    ) : (
      <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={api.reload} />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-lg border border-don-edge bg-don-ink/80 px-4 py-3 text-left">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          Доход с бизнесов
        </p>
        <p className="text-xl font-bold text-don-gold tabular-nums">
          {formatCoins(income?.perHour ?? 0)} <span className="text-sm text-neutral-400">в час</span>
        </p>
        {Number(income?.pending ?? 0) > 0 && (
          <p
            className={`mt-1 text-xs ${
              income?.full ? 'text-don-blood-light' : 'text-neutral-400'
            }`}
          >
            {income?.full
              ? `Касса переполнена: ${formatCoins(income.pending)}. Часы простаивают`
              : `Накоплено ${formatCoins(income?.pending ?? 0)} — придёт при следующем входе`}
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {businesses.map((business) => {
        // Считаем от живого баланса: флаг с сервера — снимок на момент загрузки.
        // Заблокированный рангом бизнес показываем, но купить не даём: видеть,
        // что откроется дальше, — половина мотивации качать ранг.
        const affordable =
          !business.locked && Number(state.balance) >= Number(business.nextCost);

        return (
          <div
            key={business.id}
            className={`rounded-lg border border-don-edge bg-don-ink/80 p-4 text-left ${
              business.locked ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Рисованные значки; новый бизнес без картинки получает
                  нейтральный портфель, а не дыру. */}
              <PixelIcon id={business.slug} emoji="💼" className="mt-0.5 h-6 w-6 shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-base font-semibold text-don-bone">
                    {business.name}
                  </h3>
                  <span className="shrink-0 text-[11px] tracking-[0.2em] text-neutral-400 uppercase">
                    {business.owned ? `ур. ${business.level}` : business.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-400">{business.description}</p>
              </div>
            </div>

            <p className="mt-3 text-sm">
              <span className="text-neutral-400">
                {business.owned
                  ? `${formatCoins(business.incomePerHour)} в час`
                  : 'Не куплен'}
              </span>
              <span className="mx-2 text-don-blood-light">→</span>
              <span className="font-semibold text-don-gold-soft">
                {formatCoins(business.nextIncomePerHour)} в час
              </span>
            </p>

            <button
              type="button"
              disabled={!affordable || buying !== null}
              onClick={() => api.buy(business.id)}
              className={`mt-3 min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                affordable
                  ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft active:scale-95'
                  : 'border border-neutral-700 text-neutral-400'
              }`}
            >
              {business.locked
                ? `Откроется на ранге «${business.requiredRank}»`
                : buying === business.id
                  ? 'Покупаем…'
                  : `${business.owned ? 'Улучшить' : 'Купить'} за ${formatCoins(business.nextCost)}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
