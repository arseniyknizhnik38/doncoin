import { useState } from 'react';
import { BusinessList } from '../businesses/BusinessList';
import type { BusinessesApi } from '../businesses/useBusinesses';
import type { GameState } from '../game/types';
import { PerkList } from '../perks/PerkList';
import type { PerksApi } from '../perks/usePerks';
import { UpgradeList } from '../upgrades/UpgradeList';
import type { UpgradesApi } from '../upgrades/useUpgrades';

type Mode = 'upgrades' | 'businesses' | 'perks';

interface DealScreenProps {
  upgrades: UpgradesApi;
  businesses: BusinessesApi;
  perks: PerksApi;
  state: GameState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Вкладка «Дело»: личная прокачка и бизнесы под одним переключателем.
 * Отдельная вкладка для бизнесов не влезала — их и так пять.
 */
export function DealScreen({ upgrades, businesses, perks, state }: DealScreenProps) {
  const [mode, setMode] = useState<Mode>('upgrades');

  return (
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 sm:py-6">
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

      <div className="flex gap-2 rounded-xl border border-don-blood/40 bg-don-ink/70 p-1.5">
        {(
          [
            ['upgrades', 'Прокачка'],
            ['businesses', 'Бизнесы'],
            ['perks', 'Влияние'],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              mode === id
                ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                : 'text-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'upgrades' ? (
        <UpgradeList api={upgrades} state={state} />
      ) : mode === 'businesses' ? (
        <BusinessList api={businesses} state={state} />
      ) : (
        <PerkList api={perks} />
      )}
    </div>
  );
}
