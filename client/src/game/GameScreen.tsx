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

export function GameScreen({ displayName, state, error, onTap, rewards }: GameScreenProps) {
  const energyPercent = Math.round((state.energy / state.energyMax) * 100);
  const empty = state.energy < 1;

  return (
    <div className="relative flex w-full max-w-md min-h-0 flex-1 flex-col items-center justify-between gap-3 overflow-y-auto py-3 sm:gap-6 sm:py-6">
      <header className="flex w-full flex-col items-center gap-2 px-2">
        <p className="text-[11px] tracking-[0.3em] text-neutral-500 uppercase">
          {displayName ?? 'Дон'}
        </p>

        <RankProgress rank={state.rank} earned={state.totalEarned} />

        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-don-gold tabular-nums drop-shadow-[0_0_24px_rgba(232,180,72,0.3)]">
              {formatBalance(state.balance)}
            </span>
            <span className="text-sm tracking-[0.2em] text-neutral-500 uppercase">
              DONC
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-full border border-don-blood/50 bg-don-ink/70 px-3 py-1"
          title={`${state.respectProgress} / ${state.tapsPerRespect} тапов до следующего Respect`}
        >
          <StarIcon />
          <span className="text-base font-semibold text-neutral-200 tabular-nums">
            {formatBalance(String(state.respect))}
          </span>
          <span className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
            Respect
          </span>
        </div>
      </header>

      {rewards}

      <TapCoin coinsPerTap={state.coinsPerTap} disabled={empty} onTap={onTap} />

      <footer className="flex w-full flex-col gap-2 px-2">
        <div className="flex items-center justify-between text-xs tracking-wider text-neutral-400">
          <span>
            Энергия{' '}
            <span className="text-don-gold-soft tabular-nums">
              {state.energy} / {state.energyMax}
            </span>
          </span>
          <span className="text-neutral-500">+{state.coinsPerTap} за тап</span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full border border-don-blood/50 bg-black/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-don-blood via-don-gold to-don-gold-soft transition-[width] duration-300"
            style={{ width: `${energyPercent}%` }}
          />
        </div>

        {empty && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">
            Энергия кончилась — восстанавливается {state.energyPerSecond}/сек
          </p>
        )}
        {error && (
          <p className="text-center text-xs tracking-wider text-don-blood-light">{error}</p>
        )}
      </footer>
    </div>
  );
}
