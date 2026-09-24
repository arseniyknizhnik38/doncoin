import { PixelIcon } from '../ui/PixelIcon';
import { ErrorState, SkeletonList } from '../ui/States';
import { useState } from 'react';
import { useT } from '../i18n';
import { copyTextToClipboard, shareURL } from '@telegram-apps/sdk-react';
import { buildReferralLink } from '../config';
import type { ReferralsData, TournamentData } from './types';

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

      <TournamentCard tournament={data.tournament} />

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

/** «3 дн 4 ч», «5 ч» — сколько осталось до конца недели турнира. */
function untilEnd(endsAt: string, t: (s: string, v?: Record<string, string | number>) => string): string {
  const left = new Date(endsAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(left / 3_600_000));

  return hours >= 24
    ? t('{d} дн {h} ч', { d: Math.floor(hours / 24), h: hours % 24 })
    : t('{n} ч', { n: Math.max(1, hours) });
}

/**
 * Недельный турнир кентов.
 *
 * Стоит над ссылкой приглашения — сначала причина звать, потом инструмент.
 * Верх карточки — подиум на три места: пустые ступени с призами работают
 * приглашением лучше любой строки текста, потому что видно, что первое
 * место сейчас берётся одним живым кентом. Хвост таблицы — компактным
 * списком, как в «Топе».
 */
const PODIUM_CLASS = ['text-don-gold', 'text-don-bone', 'text-don-blood-light'] as const;

function TournamentCard({ tournament }: { tournament?: TournamentData }) {
  const t = useT();

  if (!tournament) {
    return null;
  }

  const inTop = tournament.top.some((row) => row.isMe);
  const tail = tournament.top.slice(3);

  return (
    <div className="rounded-lg border border-don-gold/40 bg-don-ink/80 p-4 text-left">
      <div className="flex items-center gap-2.5">
        <PixelIcon id="trophy" className="h-6 w-6 shrink-0" />
        <h3 className="min-w-0 flex-1 font-pixel text-base leading-relaxed text-don-gold uppercase">
          {t('Турнир недели')}
        </h3>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[11px] leading-relaxed text-neutral-400">
          {t('Кто привёл больше кентов в деле — забирает билеты розыгрыша')}
        </p>
        <span className="shrink-0 text-[11px] tracking-wider text-don-gold-soft tabular-nums">
          {t('до конца {time}', { time: untilEnd(tournament.endsAt, t) })}
        </span>
      </div>

      {/* Подиум: три места всегда на экране, даже пустые. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => {
          const row = tournament.top[index];

          return (
            <div
              key={index}
              className={`rounded-lg border px-2 py-2 text-center ${
                row?.isMe
                  ? 'border-don-gold/70 bg-don-ink'
                  : 'border-don-edge bg-black/40'
              }`}
            >
              <p className={`font-pixel text-base leading-relaxed ${PODIUM_CLASS[index]}`}>
                {index + 1}
              </p>
              <p
                className={`truncate text-xs ${
                  row ? 'text-don-bone' : 'text-neutral-400'
                }`}
              >
                {row ? row.name : t('свободно')}
              </p>
              <p className="text-[11px] text-neutral-400 tabular-nums">
                {row ? t('в деле: {n}', { n: row.qualified }) : '·'}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-don-gold-soft tabular-nums">
                +{tournament.prizes[index] ?? 0} {t('бил.')}
              </p>
            </div>
          );
        })}
      </div>

      {tail.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {tail.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className={`flex items-center justify-between gap-3 text-xs ${
                row.isMe ? 'text-don-gold-soft' : 'text-neutral-400'
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 inline-block w-4 text-right tabular-nums">
                  {index + 4}
                </span>
                {row.name}
              </span>
              <span className="shrink-0 tabular-nums">
                {row.qualified} · +{tournament.prizes[index + 3] ?? 0} {t('бил.')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!inTop && tournament.my.qualified > 0 && (
        <p className="mt-2 border-t border-don-edge pt-2 text-xs text-neutral-400">
          {t('У тебя кентов в деле: {n} — зови ещё', { n: tournament.my.qualified })}
        </p>
      )}

      {tournament.last.length > 0 && (
        <p className="mt-2 border-t border-don-edge pt-2 text-[11px] text-neutral-400">
          {t('Прошлая неделя: {name} — {n} билетов', {
            name: tournament.last[0]!.name,
            n: tournament.last[0]!.tickets,
          })}
        </p>
      )}
    </div>
  );
}
