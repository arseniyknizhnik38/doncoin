import { useState } from 'react';
import { FavorsScreen } from '../favors/FavorsScreen';
import type { FavorsApi } from '../favors/useFavors';
import { FriendsScreen } from '../referrals/FriendsScreen';
import type { ReferralsState } from '../referrals/useReferrals';

type Mode = 'friends' | 'favors';

interface FamilyScreenProps {
  referrals: ReferralsState;
  favors: FavorsApi;
}

/**
 * Вкладка «Семья»: приглашённые друзья и еженедельные поручения.
 * Поручения тематически про семью («The Family needs a favor»), поэтому
 * живут здесь, а не отдельной шестой вкладкой.
 */
export function FamilyScreen({ referrals, favors }: FamilyScreenProps) {
  const [mode, setMode] = useState<Mode>('friends');

  return (
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 sm:py-6">
      <header className="text-center">
        <h2 className="text-2xl font-black tracking-[0.2em] text-don-gold uppercase">
          Семья
        </h2>
      </header>

      <div className="flex gap-2 rounded-xl border border-don-blood/40 bg-don-ink/70 p-1.5">
        {(
          [
            ['friends', 'Друзья'],
            ['favors', 'Поручения'],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              mode === id
                ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                : 'text-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'friends' ? (
        <FriendsScreen
          data={referrals.data}
          loading={referrals.loading}
          error={referrals.error}
          onRetry={referrals.reload}
        />
      ) : (
        <FavorsScreen api={favors} />
      )}
    </div>
  );
}
