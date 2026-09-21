import type React from 'react';
import { RankProgress } from './RankProgress';
import { TapCoin } from './TapCoin';
import type { GameState } from './types';

interface GameScreenProps {
  displayName: string | null;
  state: GameState;
  error: string | null;
  onTap: () => boolean;
  /** Плашка оффлайн-дохода и ежедневного бонуса. */
  rewards?: React.ReactNode;
  /** Заряды бустеров — под кнопкой тапа. */
  boosters?: React.ReactNode;
}

const formatBalance = (balance: string) =>
  Number(balance).toLocaleString('ru-RU');

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-don-gold drop-shadow-[0_0_6px_rgba(232,180,72,0.5)]"
    >
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.3l6.6-.9L12 2.5z" />
    </svg>
  );
}

export function GameScreen({
  displayName,
  state,
  error,
  onTap,
  rewards,
  boosters,
}: GameScreenProps) {
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
      <header className="flex w-full shrink-0 flex-col items-center gap-1.5 px-2">
        {/* Имя и Respect — одной строкой по краям: обе подписи мелкие, и
            каждая своей строкой отнимала у персонажа высоту зря. */}
        <div className="flex w-full items-center justify-between">
          <p className="truncate text-[11px] tracking-[0.25em] text-neutral-500 uppercase">
            {displayName ?? 'Дон'}
          </p>
          <span
            className="flex shrink-0 items-center gap-1"
            title={`${state.respectProgress} / ${state.tapsPerRespect} тапов до следующего Respect`}
          >
            <StarIcon />
            <span className="text-sm font-semibold text-neutral-200 tabular-nums">
              {formatBalance(String(state.respect))}
            </span>
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-don-gold tabular-nums drop-shadow-[0_0_24px_rgba(232,180,72,0.3)]">
            {formatBalance(state.balance)}
          </span>
          <span className="text-xs tracking-[0.2em] text-neutral-500 uppercase">
            DONC
          </span>
        </div>

        <RankProgress rank={state.rank} earned={state.totalEarned} />
      </header>

      <div className="w-full shrink-0">{rewards}</div>
      <div className="w-full shrink-0">{boosters}</div>

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
          onTap={onTap}
        />
      </div>

      <footer className="flex w-full shrink-0 flex-col gap-1.5 px-2">
        <div className="flex items-center justify-between text-xs tracking-wider text-neutral-400">
          <span>
            Обойма{' '}
            <span className="text-don-gold-soft tabular-nums">
              {tapsLeft} / {tapsMax}
            </span>
          </span>
          <span className={rushActive ? 'font-semibold text-don-gold' : 'text-neutral-500'}>
            +{perTap} за тап{rushActive ? ` ×${state.rushMultiplier}` : ''}
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full border border-don-blood/50 bg-black/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-don-blood via-don-gold to-don-gold-soft transition-[width] duration-300"
            style={{ width: `${energyPercent}%` }}
          />
        </div>

        {empty && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">
            Обойма пуста — восстанавливается {tapsPerMinute} тапов в минуту
          </p>
        )}
        {error && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
        )}
      </footer>
    </div>
  );
}
