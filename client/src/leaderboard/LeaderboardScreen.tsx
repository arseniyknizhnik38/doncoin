import { ErrorState, SkeletonList } from '../ui/States';
import { useState } from 'react';
import type { LeaderboardApi } from './useLeaderboard';

type Scope = 'players' | 'clans';

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Медали за первые три места, дальше просто номер. */
const positionLabel = (position: number) =>
  position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}`;

export function LeaderboardScreen({ board }: { board: LeaderboardApi }) {
  const [scope, setScope] = useState<Scope>('players');
  const { data, loading, error } = board;

  if (!data) {
    return (
      <div className="flex w-full max-w-md flex-1 flex-col justify-center gap-3 py-6">
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
    <div className="flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 sm:py-6">
      <header className="text-center">
        <h2 className="text-2xl font-black tracking-[0.2em] text-don-gold uppercase">Топ</h2>
      </header>

      <div className="flex gap-2 rounded-xl border border-don-blood/40 bg-don-ink/70 p-1.5">
        {(
          [
            ['players', 'Игроки'],
            ['clans', 'Кланы'],
          ] as [Scope, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              scope === id
                ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                : 'text-neutral-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {scope === 'players'
          ? data.players.top.map((entry) => (
              <Row
                key={entry.position}
                position={entry.position}
                title={entry.name}
                subtitle={`${entry.rank}${entry.clan ? ` · ${entry.clan}` : ''}`}
                value={formatCoins(entry.totalEarned)}
                highlight={entry.isMe}
              />
            ))
          : data.clans.top.map((entry) => (
              <Row
                key={entry.position}
                position={entry.position}
                title={entry.name}
                subtitle={`${entry.memberCount} в семье`}
                value={formatCoins(entry.treasury)}
                highlight={entry.isMine}
              />
            ))}

        {scope === 'players' && data.players.top.length === 0 && (
          <p className="rounded-xl border border-dashed border-don-blood/40 px-4 py-6 text-center text-xs tracking-wider text-neutral-500">
            Пока пусто
          </p>
        )}
        {scope === 'clans' && data.clans.top.length === 0 && (
          <p className="rounded-xl border border-dashed border-don-blood/40 px-4 py-6 text-center text-xs tracking-wider text-neutral-500">
            Кланов пока нет
          </p>
        )}
      </div>

      {/* Своя строка отдельно — если не попал в показанный топ. */}
      {!inTop && (
        <div className="border-t border-don-blood/30 pt-3">
          {scope === 'players' ? (
            <Row
              position={data.players.me.position}
              title={data.players.me.name}
              subtitle={data.players.me.rank}
              value={formatCoins(data.players.me.totalEarned)}
              highlight
            />
          ) : data.clans.me ? (
            <Row
              position={data.clans.me.position}
              title={data.clans.me.name}
              subtitle="ваш клан"
              value={formatCoins(data.clans.me.treasury)}
              highlight
            />
          ) : (
            <p className="text-center text-xs tracking-wider text-neutral-500">
              Вы пока не в клане
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  position: number;
  title: string;
  subtitle: string;
  value: string;
  highlight?: boolean;
}

function Row({ position, title, subtitle, value, highlight }: RowProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left ${
        highlight
          ? 'border-don-gold/50 bg-don-ink'
          : 'border-don-blood/30 bg-don-ink/60'
      }`}
    >
      <span className="w-7 shrink-0 text-center text-sm text-neutral-500 tabular-nums">
        {positionLabel(position)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-200">{title}</p>
        <p className="truncate text-[10px] tracking-wider text-neutral-500 uppercase">
          {subtitle}
        </p>
      </div>
      <span className="shrink-0 text-sm text-don-gold-soft tabular-nums">{value}</span>
    </div>
  );
}
