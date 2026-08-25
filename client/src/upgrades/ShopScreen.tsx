import type { GameState } from '../game/types';
import type { UpgradeView } from './types';

interface ShopScreenProps {
  upgrades: UpgradeView[] | null;
  state: GameState;
  loading: boolean;
  buying: string | null;
  error: string | null;
  onBuy: (id: string) => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

export function ShopScreen({
  upgrades,
  state,
  loading,
  buying,
  error,
  onBuy,
}: ShopScreenProps) {
  return (
    <div className="flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto py-6">
      <header className="text-center">
        <h2 className="text-2xl font-black tracking-[0.2em] text-don-gold uppercase">
          Наше дело
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          В казне{' '}
          <span className="font-semibold text-don-gold-soft tabular-nums">
            {formatCoins(state.balance)}
          </span>
        </p>
      </header>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {!upgrades ? (
        <p className="mt-6 text-center text-sm tracking-wider text-neutral-500">
          {loading ? 'Загружаем…' : 'Нет данных'}
        </p>
      ) : (
        upgrades.map((upgrade) => {
          const isMax = upgrade.price === null;
          const disabled = isMax || !upgrade.affordable || buying !== null;

          return (
            <div
              key={upgrade.id}
              className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-100">
                  {upgrade.title}
                </h3>
                <span className="shrink-0 text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                  ур. {upgrade.level} / {upgrade.maxLevel}
                </span>
              </div>

              <p className="mt-1 text-xs text-neutral-500">{upgrade.description}</p>

              <p className="mt-3 text-sm text-neutral-300">
                <span className="text-neutral-500">{upgrade.current}</span>
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
                onClick={() => onBuy(upgrade.id)}
                className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isMax
                    ? 'border border-don-gold/30 text-don-gold/60'
                    : upgrade.affordable
                      ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft active:scale-95'
                      : 'border border-neutral-700 text-neutral-600'
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
        })
      )}
    </div>
  );
}
