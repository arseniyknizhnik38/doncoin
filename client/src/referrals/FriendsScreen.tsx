import { ErrorState, SkeletonList } from '../ui/States';
import { useState } from 'react';
import { useT } from '../i18n';
import { copyTextToClipboard, shareURL } from '@telegram-apps/sdk-react';
import { buildReferralLink } from '../config';
import type { ReferralsData } from './types';

interface FriendsScreenProps {
  data: ReferralsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

const friendName = (friend: { firstName: string | null; username: string | null }) =>
  friend.firstName ?? (friend.username ? `@${friend.username}` : 'Аноним');

export function FriendsScreen({ data, loading, error, onRetry }: FriendsScreenProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div className="flex w-full flex-1 flex-col justify-center gap-3">
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={onRetry} />
        )}
      </div>
    );
  }

  const link = buildReferralLink(data.code);

  const handleCopy = () => {
    void copyTextToClipboard(link).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    shareURL.ifAvailable(link, t('Заходи в DONCOIN — начни с нуля, стань Доном.'));
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-center text-xs tracking-wider text-neutral-400">
        {t('+{a} тебе за каждого друга, +{b} ему на старте', {
          a: formatCoins(data.rewards.inviter),
          b: formatCoins(data.rewards.invitee),
        })}
      </p>

      {/* Условие проговариваем сразу. Иначе человек приводит друга, денег не
          видит и считает, что игра его обманула. */}
      <p className="-mt-2 text-center text-[11px] tracking-wider text-neutral-400">
        {t('Награда приходит, когда друг сделает {n} тапов', { n: formatCoins(data.qualifyTaps) })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-don-edge bg-don-ink/80 px-4 py-3">
          <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">{t('Приглашено')}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-don-gold-soft tabular-nums">
            {data.invitedCount}
          </p>
          {data.invitedCount > data.confirmedCount && (
            <p className="text-[11px] tracking-wider text-neutral-400">
              {t('засчитано {n}', { n: data.confirmedCount })}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-don-edge bg-don-ink/80 px-4 py-3">
          <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">{t('Заработано')}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-don-gold-soft tabular-nums">
            {formatCoins(data.earned)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-don-edge bg-don-ink/80 p-4">
        <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t('Твоя ссылка')}
        </p>
        <p className="mt-2 truncate rounded-lg bg-black/40 px-3 py-2 text-left text-xs text-neutral-400">
          {link}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 inline-flex items-center justify-center py-2.5 text-sm font-semibold text-don-gold-soft active:scale-95"
          >
            {t('Позвать в Telegram')}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-don-gold/40 px-4 min-h-11 inline-flex items-center justify-center py-2.5 text-sm text-don-gold active:scale-95"
          >
            {t(copied ? 'Готово' : 'Копировать')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.invited.length === 0 ? (
          <p className="rounded-lg border border-don-edge/60 px-4 py-6 text-center text-xs tracking-wider text-neutral-400">
            {t('Пока никого. Позови первого кента — дальше подтянутся сами.')}
          </p>
        ) : (
          data.invited.map((friend, index) => (
            <div
              key={`${friend.username ?? friend.firstName ?? 'friend'}-${index}`}
              className="flex items-center justify-between rounded-lg border border-don-edge bg-don-ink/80 px-4 py-2.5"
            >
              <span className="truncate text-sm text-don-bone">{t(friendName(friend))}</span>
              <span className="shrink-0 text-xs tabular-nums">
                {friend.confirmed ? (
                  <span className="text-don-gold-soft">
                    +{formatCoins(data.rewards.inviter)}
                  </span>
                ) : (
                  <span className="text-neutral-400">
                    {formatCoins(friend.taps)} / {t('{n} тапов', { n: formatCoins(data.qualifyTaps) })}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
