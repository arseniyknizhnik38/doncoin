import type { RankView } from './types';

interface RankProgressProps {
  rank: RankView;
  /** Накопленный доход: ранг считается от него, а не от текущего баланса. */
  earned: string;
}

const formatCoins = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** Ранг игрока и прогресс до следующего. */
export function RankProgress({ rank, earned }: RankProgressProps) {
  const target = rank.next ? Number(rank.next.minBalance) : null;

  // Баланс обновляется локально сразу, а ранг приходит с сервера следующим
  // ответом. В этот короткий промежуток показ ограничиваем порогом, иначе
  // на секунду мелькало бы «200 003 / 200 000». Пороги при этом остаются
  // только в серверном конфиге — дублировать их на клиент не нужно.
  const current =
    target === null ? Number(earned) : Math.min(Number(earned), target);

  // Доля считается от порога следующего ранга — так же, как читается подпись.
  const percent =
    target === null ? 100 : Math.min(100, Math.round((current / target) * 100));

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-2xl font-black tracking-[0.18em] text-don-gold-soft uppercase">
        {rank.title}
      </p>

      {rank.unlocks && (
        <p className="text-[10px] tracking-wider text-don-blood-light">
          {rank.unlocks}
        </p>
      )}

      <div className="h-2 w-full overflow-hidden rounded-full border border-don-blood/40 bg-black/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-don-blood via-don-gold to-don-gold-soft transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {rank.next ? (
        <p className="text-[11px] tracking-wider text-neutral-500">
          {formatCoins(current)} / {formatCoins(rank.next.minBalance)} ДонКоинов до{' '}
          <span className="text-don-gold-soft">{rank.next.code}</span>
        </p>
      ) : (
        <p className="text-[11px] tracking-wider text-don-gold-soft">
          Высший ранг — вершина семьи
        </p>
      )}
    </div>
  );
}
