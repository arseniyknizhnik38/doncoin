import type { WarState } from './types';

interface ClanWarPanelProps {
  war: WarState;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

const fighterName = (fighter: { firstName: string | null; username: string | null }) =>
  fighter.firstName ?? (fighter.username ? `@${fighter.username}` : 'Аноним');

/** Сколько осталось до конца войны, человеческими словами. */
function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();

  if (ms <= 0) {
    return 'подводим итоги';
  }

  const hours = Math.floor(ms / 3_600_000);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const tail = days % 10;
    const teen = days % 100 >= 11 && days % 100 <= 14;
    const word = teen || tail === 0 || tail >= 5 ? 'дней' : tail === 1 ? 'день' : 'дня';

    return `${days} ${word}`;
  }

  if (hours >= 1) {
    const tail = hours % 10;
    const teen = hours % 100 >= 11 && hours % 100 <= 14;
    const word = teen || tail === 0 || tail >= 5 ? 'часов' : tail === 1 ? 'час' : 'часа';

    return `${hours} ${word}`;
  }

  return 'меньше часа';
}

const OUTCOME = {
  win: { label: 'Победа', tone: 'text-don-gold' },
  loss: { label: 'Поражение', tone: 'text-don-blood-light' },
  draw: { label: 'Ничья', tone: 'text-neutral-400' },
} as const;

export function ClanWarPanel({ war }: ClanWarPanelProps) {
  const { current, last } = war;

  if (!current && !last) {
    return (
      <div className="rounded-xl border border-dashed border-don-blood/40 px-4 py-5 text-center">
        <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">Война</p>
        <p className="mt-2 text-xs text-neutral-500">
          Пара на эту неделю ещё не составлена. Соперник появится в понедельник.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {current && <ActiveWar war={current} />}
      {last && <LastResult result={last} />}
    </div>
  );
}

function ActiveWar({ war }: { war: NonNullable<WarState['current']> }) {
  const mine = Number(war.me.score);
  const theirs = Number(war.rival.score);
  const total = mine + theirs;
  // Пока обе стороны на нуле — полоса делится поровну, иначе она пустая и
  // выглядит как ошибка.
  const share = total > 0 ? (mine / total) * 100 : 50;
  const leading = mine > theirs;

  return (
    <div className="rounded-xl border border-don-blood/60 bg-don-ink/80 p-4 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-[0.25em] text-don-blood-light uppercase">
          Война семей
        </p>
        <p className="text-[10px] tracking-wider text-neutral-500">
          осталось {timeLeft(war.endsAt)}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-don-gold-soft">
            {war.me.name}
          </p>
          <p className="text-xl font-bold text-don-gold tabular-nums">
            {formatCoins(war.me.score)}
          </p>
        </div>
        <span className="shrink-0 pb-1 text-[10px] tracking-[0.2em] text-neutral-600">
          VS
        </span>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-neutral-300">
            {war.rival.name}
          </p>
          <p className="text-xl font-bold text-neutral-200 tabular-nums">
            {formatCoins(war.rival.score)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/60">
        <div
          className="bg-gradient-to-r from-don-gold-soft to-don-gold transition-[width] duration-500"
          style={{ width: `${share}%` }}
        />
        <div className="flex-1 bg-don-blood/70" />
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        {leading ? 'Ведём' : total === 0 ? 'Счёт не открыт' : 'Отстаём'} · ваш вклад{' '}
        <span className="text-don-gold-soft tabular-nums">
          {formatCoins(war.myEarned)}
        </span>
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">
        В счёт идёт всё, что семья заработала за неделю: тапы, бизнесы, бонусы.
      </p>

      {war.fighters.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {war.fighters.slice(0, 5).map((fighter, index) => (
            <div
              key={`${fighter.username ?? fighter.firstName ?? 'fighter'}-${index}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="truncate text-neutral-400">
                {fighterName(fighter)}
                {fighter.left && (
                  <span className="ml-1 text-[10px] text-neutral-600">вышел</span>
                )}
              </span>
              <span className="shrink-0 text-don-gold-soft tabular-nums">
                {formatCoins(fighter.earned)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LastResult({ result }: { result: NonNullable<WarState['last']> }) {
  const outcome = OUTCOME[result.outcome];

  return (
    <div className="rounded-xl border border-don-blood/30 bg-don-ink/60 px-4 py-3 text-left">
      <p className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">
        Прошлая война
      </p>
      <p className={`mt-1 text-sm font-semibold ${outcome.tone}`}>
        {outcome.label} · {result.rivalName}
      </p>
      <p className="mt-1 text-xs text-neutral-400 tabular-nums">
        {formatCoins(result.myScore)} : {formatCoins(result.rivalScore)}
      </p>
      {result.potPaid !== '0' && (
        <p className="mt-1 text-[11px] text-neutral-500">
          {result.outcome === 'win' ? 'Взяли с проигравших' : 'Ушло из общака'}:{' '}
          <span className="text-don-gold-soft">{formatCoins(result.potPaid)}</span>
        </p>
      )}
    </div>
  );
}
