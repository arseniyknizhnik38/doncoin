import type { GameState } from '../game/types';
import { ErrorState, SkeletonList } from '../ui/States';
import type { UpgradesApi } from './useUpgrades';

interface UpgradeListProps {
  api: UpgradesApi;
  state: GameState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

export function UpgradeList({ api, state }: UpgradeListProps) {
  const { upgrades, loading, buying, error } = api;

  if (!upgrades) {
    return loading ? (
      <SkeletonList rows={3} />
    ) : (
      <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={api.reload} />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {upgrades.map((upgrade) => {
        const isMax = upgrade.price === null;
        // Считаем от текущего баланса: флаг с сервера — снимок на момент
        // загрузки каталога, и после пары минут игры он врёт.
        const affordable = !isMax && Number(state.balance) >= Number(upgrade.price ?? 0);
        const disabled = isMax || !affordable || buying !== null;

        return (
          <div
            key={upgrade.id}
            className="rounded-lg border border-don-edge bg-don-ink/80 p-4 text-left"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-don-bone">{upgrade.title}</h3>
              <span className="shrink-0 text-[11px] tracking-[0.2em] text-neutral-400 uppercase">
                ур. {upgrade.level} / {upgrade.maxLevel}
              </span>
            </div>

            <p className="mt-1 text-xs text-neutral-400">{upgrade.description}</p>

            <p className="mt-3 text-sm text-neutral-400">
              <span className="text-neutral-400">{upgrade.current}</span>
              {upgrade.next && (
                <>
                  <span className="mx-2 text-don-blood-light">→</span>
                  <span className="font-semibold text-don-gold-soft">{upgrade.next}</span>
                </>
              )}
            </p>

            <button
              type="button"
              disabled={disabled}
              onClick={() => api.buy(upgrade.id)}
              className={`mt-3 min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                isMax
                  ? 'border border-don-gold/40 text-don-gold/60'
                  : affordable
                    ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft active:scale-95'
                    : 'border border-neutral-700 text-neutral-400'
              }`}
            >
              {isMax
                ? 'Максимум'
                : buying === upgrade.id
                  ? 'Покупаем…'
                  : `Купить за ${formatCoins(upgrade.price ?? 0)}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
