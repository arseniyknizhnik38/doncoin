import { useT } from '../i18n';
import { PixelIcon } from '../ui/PixelIcon';
import type { BoostersApi } from './useBoosters';

interface BoosterBarProps {
  api: BoostersApi;
}

/**
 * Два бустера под кнопкой тапа. Стоят на виду намеренно: три бесплатных
 * заряда в сутки — это три причины зайти, и работают они, только если
 * видны.
 */
export function BoosterBar({ api }: BoosterBarProps) {
  const t = useT();

  if (!api.boosters) {
    return null;
  }

  return (
    <div className="flex w-full gap-2 px-2">
      {api.boosters.map((booster) => {
        const spent = booster.left === 0;
        const active = booster.activeSeconds > 0;

        return (
          <button
            key={booster.id}
            type="button"
            disabled={spent || api.using !== null || active}
            onClick={() => api.use(booster.id)}
            title={t(booster.description)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? 'border-don-gold bg-don-gold/15 text-don-gold'
                : spent
                  ? 'border-neutral-800 text-neutral-400'
                  : 'border-don-edge bg-don-ink/80 text-don-gold-soft active:scale-95'
            }`}
          >
            <PixelIcon id={booster.id} emoji="✨" className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(booster.title)}</span>
            <span className="tabular-nums text-neutral-400">
              {active ? t('{n} с', { n: booster.activeSeconds }) : `${booster.left}/${booster.perDay}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
