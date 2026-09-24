import { ErrorState, SkeletonList } from '../ui/States';
import { PixelIcon } from '../ui/PixelIcon';
import { useState } from 'react';
import { useT } from '../i18n';
import type { LeaderboardApi } from './useLeaderboard';
import type { LeagueApi } from './useLeague';

type Scope = 'players' | 'clans' | 'league';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/**
 * Первые три места выделяются цветом номера, а не медальками-эмодзи:
 * эмодзи в этой игре больше нет нигде, и топ не исключение. Золото, кость и
 * терракота — те же три степени почёта, но нашей краской.
 */
const positionClass = (position: number) =>
  position === 1
    ? 'font-pixel text-xs text-don-gold'
    : position === 2
      ? 'font-pixel text-xs text-don-bone'
      : position === 3
        ? 'font-pixel text-xs text-don-blood-light'
        : 'text-sm text-neutral-400';

export function LeaderboardScreen({ board, league }: { board: LeaderboardApi; league: LeagueApi }) {
  const t = useT();
  const [scope, setScope] = useState<Scope>('players');
  const { data, loading, error } = board;

  if (!data) {
    return (
      <div className="flex w-full max-w-md flex-1 flex-col justify-center gap-3 pt-2 pb-6">
        {loading ? (
          <SkeletonList rows={5} />
        ) : (
          <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={board.reload} />
        )}
      </div>
    );
  }

  const inTop =
    scope === 'players'
      ? data.players.top.some((entry) => entry.isMe)
      : data.clans.top.some((entry) => entry.isMine);

  return (
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 pb-4 [&>*]:shrink-0">
      <header className="text-center">
        <h2 className="font-pixel text-2xl leading-relaxed text-don-gold uppercase">{t('Топ')}</h2>
      </header>

      <div className="flex gap-2 rounded-lg border border-don-edge bg-don-ink/80 p-1.5">
        {(
          [
            ['players', 'Игроки'],
            ['clans', 'Семьи'],
            ['league', 'Лига'],
          ] as [Scope, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              scope === id
                ? 'bg-don-blood border-b-2 border-b-don-blood-deep text-don-gold-soft'
                : 'text-neutral-400'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {scope === 'league' ? (
        <LeagueBoard api={league} />
      ) : (
      <div className="flex flex-col gap-2">
        {scope === 'players'
          ? data.players.top.map((entry) => (
              <Row
                key={entry.position}
                position={entry.position}
                title={entry.name}
                subtitle={`${t(entry.rank)}${entry.clan ? ` · ${entry.clan}` : ''}`}
                emblem={RANK_EMBLEMS[entry.rank]}
                value={formatCoins(entry.totalEarned)}
                highlight={entry.isMe}
              />
            ))
          : data.clans.top.map((entry) => (
              <Row
                key={entry.position}
                position={entry.position}
                title={entry.name}
                subtitle={t('{n} в семье', { n: entry.memberCount })}
                value={formatCoins(entry.treasury)}
                highlight={entry.isMine}
              />
            ))}

        {scope === 'players' && data.players.top.length === 0 && (
          <p className="rounded-lg border border-don-edge/60 px-4 py-6 text-center text-xs tracking-wider text-neutral-400">
            {t('Пока пусто')}
          </p>
        )}
        {scope === 'clans' && data.clans.top.length === 0 && (
          <p className="rounded-lg border border-don-edge/60 px-4 py-6 text-center text-xs tracking-wider text-neutral-400">
            {t('Семей пока нет')}
          </p>
        )}
      </div>
      )}

      {/* Своя строка отдельно — если не попал в показанный топ. */}
      {scope !== 'league' && !inTop && (
        <div className="border-t border-don-edge pt-3">
          {scope === 'players' ? (
            <Row
              position={data.players.me.position}
              title={data.players.me.name}
              subtitle={t(data.players.me.rank)}
              emblem={RANK_EMBLEMS[data.players.me.rank]}
              value={formatCoins(data.players.me.totalEarned)}
              highlight
            />
          ) : data.clans.me ? (
            <Row
              position={data.clans.me.position}
              title={data.clans.me.name}
              subtitle={t('ваша семья')}
              value={formatCoins(data.clans.me.treasury)}
              highlight
            />
          ) : (
            <p className="text-center text-xs tracking-wider text-neutral-400">
              {t('Вы пока не в семье')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Ранг в топе приходит названием — знак подбираем по нему. */
const RANK_EMBLEMS: Record<string, string> = {
  'Аутсайдер': 'rank-outsider',
  'Приближённый': 'rank-associate',
  'Солдат': 'rank-soldier',
  'Капо': 'rank-capo',
  'Консильери': 'rank-consigliere',
  'Дон': 'rank-don',
};

interface RowProps {
  position: number;
  title: string;
  subtitle: string;
  value: string;
  highlight?: boolean;
  emblem?: string;
}

function Row({ position, title, subtitle, value, highlight, emblem }: RowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left ${
        highlight
          ? 'border-don-gold/70 bg-don-ink'
          : 'border-don-edge bg-don-ink/80'
      }`}
    >
      <span className={`w-7 shrink-0 text-center tabular-nums ${positionClass(position)}`}>
        {position}
      </span>
      {emblem && <PixelIcon id={emblem} className="h-6 w-6 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-don-bone">{title}</p>
        <p className="truncate text-[11px] tracking-wider text-neutral-400 uppercase">
          {subtitle}
        </p>
      </div>
      <span className="shrink-0 text-sm text-don-gold-soft tabular-nums">{value}</span>
    </div>
  );
}

/** «2 дн 14 ч» до конца недели лиги. */
function leagueTimeLeft(endsAt: string, t: (s: string, v?: Record<string, string | number>) => string): string {
  const left = new Date(endsAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(left / 3_600_000));

  return hours >= 24
    ? t('{d} дн {h} ч', { d: Math.floor(hours / 24), h: hours % 24 })
    : t('{n} ч', { n: Math.max(1, hours) });
}

const OUTCOME_LINE = {
  up: { text: 'На прошлой неделе: повышение', tone: 'text-don-gold' },
  down: { text: 'На прошлой неделе: понижение', tone: 'text-don-blood-light' },
} as const;

/**
 * Группа личной лиги: полсотни равных и два порога между ними.
 *
 * Зоны повышения и вылета показываются разделителями прямо в таблице:
 * игрок должен видеть не «я 17-й», а «мне два места до зоны повышения».
 */
function LeagueBoard({ api }: { api: LeagueApi }) {
  const t = useT();
  const { league, loading } = api;

  if (!league) {
    return loading ? (
      <SkeletonList rows={5} />
    ) : (
      <p className="rounded-lg border border-don-edge/60 px-4 py-6 text-center text-xs tracking-wider text-neutral-400">
        {t('Лига соберётся после первого захода на этой неделе')}
      </p>
    );
  }

  const outcome = league.lastOutcome && league.lastOutcome !== 'stay'
    ? OUTCOME_LINE[league.lastOutcome]
    : null;
  const demoteFrom = league.demoteCount > 0
    ? league.standings.length - league.demoteCount
    : Infinity;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-don-gold/40 bg-don-ink/80 p-4 text-left">
        <div className="flex items-center gap-2.5">
          <PixelIcon id="trophy" className="h-6 w-6 shrink-0" />
          <h3 className="min-w-0 flex-1 font-pixel text-base leading-relaxed text-don-gold uppercase">
            {t(league.tierTitle)}
          </h3>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <p className="text-[11px] tracking-wider text-neutral-400">
            {t('лига {a} из {b}', { a: league.tier + 1, b: league.tiersTotal })}
            {league.promoteCount > 0 &&
              ` · ${t('вверх уходят {n}', { n: league.promoteCount })}`}
          </p>
          <span className="shrink-0 text-[11px] tracking-wider text-don-gold-soft tabular-nums">
            {t('до конца {time}', { time: leagueTimeLeft(league.endsAt, t) })}
          </span>
        </div>
        {outcome && (
          <p className={`mt-1 text-[11px] tracking-wider ${outcome.tone}`}>
            {t(outcome.text)}
          </p>
        )}
      </div>

      {league.standings.map((row, index) => (
        <div key={`${row.name}-${index}`}>
          {index === league.promoteCount && league.promoteCount > 0 && (
            <p className="mb-2 border-t border-don-gold/40 pt-1 text-center text-[10px] tracking-[0.25em] text-don-gold-soft uppercase">
              {t('выше — зона повышения')}
            </p>
          )}
          {index === demoteFrom && (
            <p className="mb-2 border-t border-don-blood/50 pt-1 text-center text-[10px] tracking-[0.25em] text-don-blood-light uppercase">
              {t('ниже — зона вылета')}
            </p>
          )}
          <Row
            position={index + 1}
            title={row.name}
            subtitle={t('за неделю')}
            value={formatCoins(row.earned)}
            highlight={row.isMe}
          />
        </div>
      ))}
    </div>
  );
}
