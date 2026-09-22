import { FriendsScreen } from '../referrals/FriendsScreen';
import type { ReferralsState } from '../referrals/useReferrals';

interface FamilyScreenProps {
  referrals: ReferralsState;
}

/**
 * Вкладка «Семья»: приглашённые друзья.
 *
 * Подписки на каналы («поручения») раньше жили здесь второй вкладкой и
 * терялись из виду — теперь они в «Заданиях», сразу под Шифром Омерты.
 */
export function FamilyScreen({ referrals }: FamilyScreenProps) {
  return (
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 pb-4 [&>*]:shrink-0">
      <header className="text-center">
        <h2 className="font-pixel text-2xl leading-relaxed text-don-gold uppercase">
          Семья
        </h2>
      </header>

      <FriendsScreen
        data={referrals.data}
        loading={referrals.loading}
        error={referrals.error}
        onRetry={referrals.reload}
      />
    </div>
  );
}
