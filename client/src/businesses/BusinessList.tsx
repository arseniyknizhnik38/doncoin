import type { GameState } from '../game/types';
import { ErrorState, SkeletonList } from '../ui/States';
import type { BusinessesApi } from './useBusinesses';

interface BusinessListProps {
  api: BusinessesApi;
  state: GameState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Иконки держим на клиенте: это оформление, а не данные каталога. */
const ICONS: Record<string, string> = {
  pizzeria: '🍕',
  car_wash: '🚿',
  restaurant: '🍽️',
  night_club: '🎧',
  construction: '🏗️',
  private_club: '🥃',
  port: '🚢',
};

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
      <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 px-4 py-3 text-left">
        <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
          Доход с бизнесов
        </p>
        <p className="text-xl font-bold text-don-gold tabular-nums">
          {formatCoins(income?.perHour ?? 0)} <span className="text-sm text-neutral-500">в час</span>
        </p>
        {Number(income?.pending ?? 0) > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Накоплено {formatCoins(income?.pending ?? 0)} — придёт при следующем входе
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {businesses.map((business) => {
        // Считаем от живого баланса: флаг с сервера — снимок на момент загрузки.
        const affordable = Number(state.balance) >= Number(business.nextCost);

        return (
          <div
            key={business.id}
            className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                {ICONS[business.slug] ?? '💼'}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-base font-semibold text-neutral-100">
                    {business.name}
                  </h3>
                  <span className="shrink-0 text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                    {business.owned ? `ур. ${business.level}` : business.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{business.description}</p>
              </div>
            </div>

            <p className="mt-3 text-sm">
              <span className="text-neutral-500">
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
              className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                affordable
                  ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft active:scale-95'
                  : 'border border-neutral-700 text-neutral-600'
              }`}
            >
              {buying === business.id
                ? 'Покупаем…'
                : `${business.owned ? 'Улучшить' : 'Купить'} за ${formatCoins(business.nextCost)}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
