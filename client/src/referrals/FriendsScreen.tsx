import { useState } from 'react';
import { copyTextToClipboard, shareURL } from '@telegram-apps/sdk-react';
import { buildReferralLink } from '../config';
import type { ReferralsData } from './types';

interface FriendsScreenProps {
  data: ReferralsData | null;
  loading: boolean;
  error: string | null;
}

const formatCoins = (value: string) => Number(value).toLocaleString('ru-RU');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const friendName = (friend: { firstName: string | null; username: string | null }) =>
  friend.firstName ?? (friend.username ? `@${friend.username}` : 'Аноним');

export function FriendsScreen({ data, loading, error }: FriendsScreenProps) {
  const [copied, setCopied] = useState(false);

  if (error) {
    return <p className="mt-10 text-sm tracking-wider text-don-blood-light">{error}</p>;
  }

  if (!data) {
    return (
      <p className="mt-10 text-sm tracking-wider text-neutral-500">
        {loading ? 'Загружаем…' : 'Нет данных'}
      </p>
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
    shareURL.ifAvailable(link, 'Заходи в DONCOIN — начни с нуля, стань Доном.');
  };

  return (
    <div className="flex w-full max-w-md flex-1 flex-col gap-5 overflow-y-auto py-6">
      <header className="text-center">
        <h2 className="text-2xl font-black tracking-[0.2em] text-don-gold uppercase">
          Семья
        </h2>
        <p className="mt-2 text-xs tracking-wider text-neutral-500">
          +{formatCoins(data.rewards.inviter)} тебе за каждого друга,{' '}
          +{formatCoins(data.rewards.invitee)} ему на старте
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 px-4 py-3">
          <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">Приглашено</p>
          <p className="mt-1 text-2xl font-bold text-don-gold-soft tabular-nums">
            {data.invitedCount}
          </p>
        </div>
        <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 px-4 py-3">
          <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">Заработано</p>
          <p className="mt-1 text-2xl font-bold text-don-gold-soft tabular-nums">
            {formatCoins(data.earned)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4">
        <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
          Твоя ссылка
        </p>
        <p className="mt-2 truncate rounded-lg bg-black/50 px-3 py-2 text-left text-xs text-neutral-300">
          {link}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 rounded-lg bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-2.5 text-sm font-semibold text-don-gold-soft active:scale-95"
          >
            Позвать в Telegram
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-don-gold/40 px-4 py-2.5 text-sm text-don-gold active:scale-95"
          >
            {copied ? 'Готово' : 'Копировать'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.invited.length === 0 ? (
          <p className="rounded-xl border border-dashed border-don-blood/40 px-4 py-6 text-center text-xs tracking-wider text-neutral-500">
            Пока никого. Позови первого — и семья начнёт расти.
          </p>
        ) : (
          data.invited.map((friend, index) => (
            <div
              key={`${friend.username ?? friend.firstName ?? 'friend'}-${index}`}
              className="flex items-center justify-between rounded-lg border border-don-blood/30 bg-don-ink/60 px-4 py-2.5"
            >
              <span className="truncate text-sm text-neutral-200">{friendName(friend)}</span>
              <span className="shrink-0 text-xs text-neutral-500">
                {formatDate(friend.joinedAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
