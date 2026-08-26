import { ErrorState, SkeletonList } from '../ui/States';
import type { PerksApi } from './usePerks';

export function PerkList({ api }: { api: PerksApi }) {
  const { perks, respect, loading, buying, error } = api;

  if (!perks) {
    return loading ? (
      <SkeletonList rows={3} />
    ) : (
      <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={api.reload} />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 px-4 py-3 text-left">
        <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
          Свободный Respect
        </p>
        <p className="text-xl font-bold text-don-gold tabular-nums">
          ★ {respect?.available ?? 0}
          <span className="ml-2 text-xs font-normal text-neutral-500">
            из {respect?.total ?? 0} заработанных
          </span>
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Respect копится за тапы и не сгорает — тратится только «свободный» остаток.
        </p>
      </div>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
      )}

      {perks.map((perk) => {
        const isMax = perk.cost === null;
        const affordable = perk.affordable;

        return (
          <div
            key={perk.id}
            className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-neutral-100">{perk.title}</h3>
              <span className="shrink-0 text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                ур. {perk.level} / {perk.maxLevel}
              </span>
            </div>

            <p className="mt-1 text-xs text-neutral-500">{perk.description}</p>

            <p className="mt-3 text-sm">
              <span className="text-neutral-500">+{perk.bonus}%</span>
              {perk.nextBonus !== null && (
                <>
                  <span className="mx-2 text-don-blood-light">→</span>
                  <span className="font-semibold text-don-gold-soft">+{perk.nextBonus}%</span>
                </>
              )}
            </p>

            <button
              type="button"
              disabled={isMax || !affordable || buying !== null}
              onClick={() => api.buy(perk.id)}
              className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                isMax
                  ? 'border border-don-gold/30 text-don-gold/60'
                  : affordable
                    ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft active:scale-95'
                    : 'border border-neutral-700 text-neutral-600'
              }`}
            >
              {isMax
                ? 'Максимум'
                : buying === perk.id
                  ? 'Покупаем…'
                  : `Купить за ★ ${perk.cost}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
