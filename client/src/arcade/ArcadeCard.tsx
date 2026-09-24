import { useState } from 'react';
import { useT } from '../i18n';
import { PixelIcon } from '../ui/PixelIcon';
import { ArcadeGame } from './ArcadeGame';
import type { ArcadeApi } from './useArcade';

/**
 * Вход в «Сбор выручки» из панели заданий.
 *
 * Сыгранный день не прячет карточку, а показывает рекорд: личный счёт —
 * причина вернуться завтра, а спрятанная карточка — просто дыра.
 */
export function ArcadeCard({ api }: { api: ArcadeApi }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const status = api.status;

  if (!status) {
    return null;
  }

  if (playing) {
    return (
      <ArcadeGame
        api={api}
        onClose={() => {
          api.resetResult();
          setPlaying(false);
        }}
      />
    );
  }

  if (!status.available) {
    return (
      <p className="truncate rounded-lg border border-don-edge bg-don-ink/80 px-3 py-1 text-center text-[11px] tracking-wider text-neutral-400">
        {status.best > 0
          ? t('Выручка сдана. Рекорд: {n}. Новый заход — завтра', { n: status.best })
          : t('Выручка сдана. Новый заход — завтра')}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-don-gold/40 bg-don-ink px-3 min-h-11 py-2 text-sm font-semibold text-don-gold active:scale-95"
    >
      <PixelIcon id="rank-capo" className="h-5 w-5" />
      {t('Сбор выручки: 30 секунд')}
      {status.best > 0 && (
        <span className="text-xs font-normal text-neutral-400">
          · {t('рекорд {n}', { n: status.best })}
        </span>
      )}
    </button>
  );
}
