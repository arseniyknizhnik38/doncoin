import { useT } from '../i18n';
import { ErrorState, SkeletonList } from '../ui/States';
import type { PerksApi } from './usePerks';

export function PerkList({ api }: { api: PerksApi }) {
  const t = useT();
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
      <div className="rounded-lg border border-don-edge bg-don-ink/80 px-4 py-3 text-left">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t('Свободный Respect')}
        </p>
        <p className="text-xl font-bold text-don-gold tabular-nums">
          ★ {respect?.available ?? 0}
          <span className="ml-2 text-xs font-normal text-neutral-400">
            {t('из {n} заработанных', { n: respect?.total ?? 0 })}
          </span>
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t('Respect копится за тапы и не сгорает — тратится только «свободный» остаток.')}
        </p>
      </div>

      {error && (
        <p className="text-center text-xs tracking-wider text-don-blood-light">{t(error)}</p>
      )}

      {perks.map((perk) => {
        const isMax = perk.cost === null;
        const affordable = perk.affordable;

        return (
          <div
            key={perk.id}
            className="rounded-lg border border-don-edge bg-don-ink/80 p-4 text-left"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-don-bone">{t(perk.title)}</h3>
              <span className="shrink-0 text-[11px] tracking-[0.2em] text-neutral-400 uppercase">
                {t('ур.')} {perk.level} / {perk.maxLevel}
              </span>
            </div>

            <p className="mt-1 text-xs text-neutral-400">{t(perk.description)}</p>

            <p className="mt-3 text-sm">
              <span className="text-neutral-400">+{perk.bonus}%</span>
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
              className={`mt-3 min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                isMax
                  ? 'border border-don-gold/40 text-don-gold/60'
                  : affordable
                    ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft active:scale-95'
                    : 'border border-neutral-700 text-neutral-400'
              }`}
            >
              {isMax
                ? t('Максимум')
                : buying === perk.id
                  ? t('Покупаем…')
                  : t('Купить за ★ {n}', { n: perk.cost ?? 0 })}
            </button>
          </div>
        );
      })}
    </div>
  );
}
