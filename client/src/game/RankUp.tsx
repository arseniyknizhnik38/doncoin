import { useEffect } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk-react';
import { useT } from '../i18n';
import { RANK_SPRITES } from './TapCoin';
import type { RankView } from './types';

interface RankUpProps {
  rank: RankView;
  onClose: () => void;
}

/**
 * Повышение — событие, а не смена подписи.
 *
 * Раньше ранг менялся молча: игрок неделями шёл к ступени, а игра в этот
 * момент даже не моргала. Теперь на секунду останавливается всё: новая
 * фигура, титул, что открылось. Это тот самый момент, ради которого тапали.
 *
 * Здесь же живёт строка «что открылось»: из шапки её убрали, потому что
 * постоянная плашка про разовое событие — шум. А тут она и есть событие.
 */
export function RankUp({ rank, onClose }: RankUpProps) {
  const t = useT();

  useEffect(() => {
    hapticFeedback.notificationOccurred.ifAvailable('success');
  }, []);

  const sprite = RANK_SPRITES[rank.id];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between px-6 py-10">
        <p className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          {t('Повышение')}
        </p>

        {/* Фигура вылетает ступенями, без плавного наезда: у пиксельной сцены
            переходы жёсткие. Кадр и геометрия — те же, что на главном экране. */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {sprite && (
            <span
              aria-hidden
              className="don-frame relative block aspect-square h-[38vh] max-h-80 animate-pop-in select-none"
            >
              <span
                className="don-strip block"
                style={{ backgroundImage: `url(${sprite})` }}
              />
            </span>
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <h2 className="animate-pop-in font-display text-4xl font-semibold tracking-[0.12em] text-don-gold uppercase">
              {rank.title}
            </h2>
            <p className="text-sm tracking-[0.25em]" aria-hidden>
              {Array.from({ length: rank.stars }, (_, index) => (
                <span
                  key={index}
                  className={index < rank.star ? 'text-don-gold' : 'text-neutral-700'}
                >
                  ★
                </span>
              ))}
            </p>
          </div>

          {rank.unlocks && (
            <p className="rounded-lg border border-don-gold/40 bg-don-ink/80 px-4 py-2 text-sm text-don-gold-soft">
              {rank.unlocks}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wider text-don-gold-soft active:scale-95"
          >
            {t('В дело')}
          </button>
        </div>
      </div>
    </div>
  );
}
