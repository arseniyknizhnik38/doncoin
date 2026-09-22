import { useEffect, useState } from 'react';
import { useT } from '../i18n';

/** Кадров в ленте Бобби и как быстро они сменяются: видео резалось на 8 к/с. */
const BOBBY_FRAMES = 8;
const BOBBY_FRAME_MS = 125;

/**
 * Какая лента играет на каком шаге.
 *
 * Где Бобби просто рассказывает — он разводит руками; где отправляет игрока
 * в конкретное место экрана — поднимает ладонь, показывая. У «показывает»
 * чистого цикла в исходнике нет, поэтому кадры идут туда-обратно: у
 * пинг-понга стыка не бывает по построению.
 */
const BOBBY_BY_STEP: readonly { file: string; pingpong?: boolean }[] = [
  { file: '/bobby.webp' },
  { file: '/bobby-point.webp', pingpong: true },
  { file: '/bobby-point.webp', pingpong: true },
  // Финал: кивает и раскрывает ладони — «всё, ты в деле».
  { file: '/bobby-approve.webp' },
];

/** Порядок кадров туда-обратно: 0..7, затем 6..1. */
const PINGPONG = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1] as const;

interface OnboardingProps {
  onDone: () => void;
}

interface Step {
  badge: string;
  title: string;
  body: string;
}

/**
 * Обучение ведёт Толстый Бобби — четыре реплики, которые новичок видит раз.
 *
 * Раньше это были четыре безликих экрана текста. Теперь объясняет человек
 * из мира игры: тот самый, от чьего имени бот потом пишет пропавшим кентам.
 * Он нарочно недотёпа — дон посадил его на салаты, и это его главная боль:
 * смешной рассказчик запоминается, а с ним запоминаются и правила.
 *
 * Каждая реплика по-прежнему объясняет ровно одну вещь и заканчивается тем,
 * что игроку делать дальше.
 */
const STEPS: readonly Step[] = [
  {
    badge: 'Шаг 1',
    title: 'Ты никто',
    body: 'Слушай сюда. Тапай — каждый тап кладёт монеты в карман. Я тоже так начинал. Правда, я до сих пор не ушёл дальше, но у тебя-то получится.',
  },
  {
    badge: 'Шаг 2',
    title: 'Обойма кончается',
    body: 'За заход выбьешь одну полную обойму, дальше она копится сама, часа полтора. Как раз успеешь поесть. Мне-то дон велел одни салаты… короче, заходи несколько раз в день.',
  },
  {
    badge: 'Шаг 3',
    title: 'Деньги должны работать',
    body: 'Во вкладке «Дело» бери улучшения и бизнесы — они капают, пока тебя нет. Только касса переполняется за четыре часа. Я свою однажды на неделю забыл. Не будем об этом.',
  },
  {
    badge: 'Шаг 4',
    title: 'Один в поле не воин',
    body: 'Зови друзей, вступай в семью, забирай бонус каждый день. Пропустишь день — серия сгорит. У меня так с диетой вышло. Всё, иди работай. И это — меня здесь не было.',
  },
];

export function Onboarding({ onDone }: OnboardingProps) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  // Бобби «говорит» всё время, пока открыт экран: он рассказчик, а не
  // кнопка, — замирать между репликами ему не с чего.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTick((value) => value + 1),
      BOBBY_FRAME_MS,
    );

    return () => window.clearInterval(timer);
  }, []);

  const sprite = BOBBY_BY_STEP[index] ?? BOBBY_BY_STEP[0]!;
  const frame = sprite.pingpong
    ? PINGPONG[tick % PINGPONG.length]!
    : tick % BOBBY_FRAMES;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 py-8">
        <p className="text-center text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
          {t(step.badge)}
        </p>

        {/* Бобби стоит ступнями на плашке своей реплики. Лента и геометрия —
            те же, что у игровых фигур (кадр 192, ступни на 188-й строке),
            поэтому и код показа тот же: .don-strip со сдвигом по кадрам. */}
        <div className="flex min-h-0 flex-1 items-end justify-center">
          <span
            aria-hidden
            className="don-frame relative block aspect-square h-[36vh] max-h-72 select-none"
          >
            <span
              className="don-strip block"
              style={{
                backgroundImage: `url(${sprite.file})`,
                transform: `translateX(-${(frame * 100) / BOBBY_FRAMES}%)`,
              }}
            />
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-don-edge bg-don-ink/80 p-4 text-left">
            <p className="text-[11px] tracking-[0.25em] text-neutral-400 uppercase">
              {t('Толстый Бобби')}
            </p>
            <h2 className="mt-2 font-pixel text-base leading-relaxed text-don-gold uppercase">
              {t(step.title)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-don-bone">{t(step.body)}</p>
          </div>

          <div className="flex justify-center gap-2">
            {STEPS.map((item, position) => (
              <span
                key={item.badge}
                className={`h-1.5 rounded-full transition-all ${
                  position === index ? 'w-6 bg-don-gold' : 'w-1.5 bg-neutral-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => (last ? onDone() : setIndex(index + 1))}
            className="w-full rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wider text-don-gold-soft active:scale-95"
          >
            {last ? t('За работу') : t('Дальше')}
          </button>

          {!last && (
            <button
              type="button"
              onClick={onDone}
              className="text-xs tracking-wider text-neutral-400"
            >
              {t('Пропустить')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
