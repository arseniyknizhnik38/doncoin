import { useT } from '../i18n';
import { TapCoin } from './TapCoin';
import type { GameState } from './types';

interface GameScreenProps {
  state: GameState;
  error: string | null;
  onTap: () => boolean;
}

/*
 * Плашка под показания.
 *
 * Сплошная заливка с чёткой рамкой, а не растяжка в полэкрана: у сцены
 * нарисованы края, и мягкий переход поверх неё читается как брак картинки.
 * Панель же видно как панель — она занимает столько, сколько занимает текст.
 */
const PLATE = 'rounded-lg border border-don-edge bg-don-black/90';

export function GameScreen({
  state,
  error,
  onTap,
}: GameScreenProps) {
  const t = useT();
  const energyPercent = Math.round((state.energy / state.energyMax) * 100);
  const empty = state.energy < state.energyPerTap;

  // Энергия хранится в долях тапа (см. server/src/lib/energy.ts), а игроку
  // интересно ровно одно: сколько тапов осталось.
  const tapsLeft = Math.floor(state.energy / state.energyPerTap);
  const tapsMax = Math.floor(state.energyMax / state.energyPerTap);
  const tapsPerMinute = Math.round((state.energyPerSecond * 60) / state.energyPerTap);

  // «Разгон» кончается сам, без запроса к серверу, поэтому судить по одному
  // лишь последнему ответу нельзя — сверяемся с часами на каждом рендере.
  const rushActive =
    state.rushUntil !== null && new Date(state.rushUntil).getTime() > Date.now();
  const perTap = rushActive ? state.coinsPerTap * state.rushMultiplier : state.coinsPerTap;

  return (
    <div className="relative flex w-full max-w-md min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden py-2">
      {/* На главном экране осталось четыре вещи: ранг, деньги, человек и
          обойма. Всё остальное — бонус дня, задания, бустеры, конверт — живёт
          в меню: каждая плашка здесь отнимала высоту у персонажа, ради
          которого экран и существует. */}
      {/* Персонажу достаётся вся оставшаяся высота, сколько бы ни заняли
          плашки сверху, и он прижат к низу этого места — ноги всегда на
          одной линии. Раньше рост задавался долей экрана: вместе с плашками
          фигура не помещалась, и её приходилось выискивать прокруткой, а
          листаться игре нельзя вовсе. */}
      <div className="flex min-h-0 w-full flex-1 items-end justify-center">
        <TapCoin
          coinsPerTap={perTap}
          disabled={empty}
          rankId={state.rank.id}
          scale={state.backdropScale}
          backdrop={state.backdrop}
          onTap={onTap}
        />
      </div>

      <footer className={`flex w-full shrink-0 flex-col gap-1.5 px-3 py-2 ${PLATE}`}>
        <div className="flex items-center justify-between text-xs tracking-wider text-neutral-400">
          <span>
            {t('Обойма')}{' '}
            <span className="text-don-gold-soft tabular-nums">
              {tapsLeft} / {tapsMax}
            </span>
          </span>
          <span className={rushActive ? 'font-semibold text-don-gold' : 'text-neutral-400'}>
            +{perTap} {t('за тап')}{rushActive ? ` ×${state.rushMultiplier}` : ''}
          </span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full border border-don-edge bg-black/40">
          <div
            className="h-full rounded-full bg-don-gold transition-[width] duration-300"
            style={{ width: `${energyPercent}%` }}
          />
        </div>

        {empty && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">
            {t('Обойма пуста — восстанавливается {n} тапов в минуту', { n: tapsPerMinute })}
          </p>
        )}
        {error && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">{t(error)}</p>
        )}
      </footer>
    </div>
  );
}
