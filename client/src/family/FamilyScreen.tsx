import { useT } from '../i18n';
import { FriendsScreen } from '../referrals/FriendsScreen';
import type { ReferralsState } from '../referrals/useReferrals';

interface FamilyScreenProps {
  referrals: ReferralsState;
}

/**
 * Вкладка «Кенты»: приглашённые друзья.
 *
 * Подписки на каналы («поручения») раньше жили здесь второй вкладкой и
 * терялись из виду — теперь они в «Заданиях», сразу под Шифром Омерты.
 */
export function FamilyScreen({ referrals }: FamilyScreenProps) {
  const t = useT();

  return (
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 pb-4 [&>*]:shrink-0">
      <header className="text-center">
        <h2 className="font-pixel text-2xl leading-relaxed text-don-gold uppercase">
          {t('Кенты')}
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
