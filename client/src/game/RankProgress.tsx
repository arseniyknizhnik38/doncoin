import type { RankView } from './types';

interface RankProgressProps {
  rank: RankView;
  /** Накопленный доход: ранг считается от него, а не от текущего баланса. */
  earned: string;
}

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
      {/* Ранг и звёзды — одно сообщение, поэтому и строка одна. Раздельными
          строками шапка разрасталась на пустом месте. */}
      <p className="flex items-baseline gap-2.5 font-display text-xl font-semibold tracking-[0.2em] text-don-gold-soft uppercase">
        {rank.title}
        <span
          className="text-sm tracking-[0.25em]"
          aria-label={`Звезда ${rank.star} из ${rank.stars}`}
        >
          {Array.from({ length: rank.stars }, (_, index) => (
            <span
              key={index}
              className={index < rank.star ? 'text-don-gold' : 'text-neutral-700'}
            >
              ★
            </span>
          ))}
        </span>
      </p>

      {/* Полоска толстая и подписи под собой не держит: раньше под ней шла
          строка «ещё столько-то до такого-то ранга», а сама полоска была
          тоньше этой строки — объяснение весило больше предмета.

          Сколько осталось, видно по заполнению; до какой ступени — по
          незажжённым звёздам рядом с названием. */}
      <div
        className="h-3 w-full overflow-hidden rounded-full border border-don-edge bg-black/40"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          rank.next ? `До ранга ${rank.next.title}` : 'Высший ранг достигнут'
        }
      >
        <div
          className="h-full bg-don-gold transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
