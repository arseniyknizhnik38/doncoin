import { useState } from 'react';

interface OnboardingProps {
  onDone: () => void;
}

interface Step {
  badge: string;
  title: string;
  body: string;
}

/**
 * Четыре экрана, которые новичок видит один раз.
 *
 * Раньше человек попадал в игру без единого слова: монета, цифры, пять
 * вкладок — и догадывайся сам, почему энергия кончилась и зачем возвращаться.
 * Каждый экран объясняет ровно одну вещь и заканчивается тем, что игроку
 * делать дальше.
 */
const STEPS: readonly Step[] = [
  {
    badge: 'Шаг 1',
    title: 'Ты никто',
    body: 'Тапай. Каждый тап — монеты в карман. Это единственное, что ты сейчас умеешь, и этого хватит, чтобы начать.',
  },
  {
    badge: 'Шаг 2',
    title: 'Обойма кончается',
    body: 'За один заход можно выбить только полную обойму. Она копится сама, примерно за полтора часа. Заходи несколько раз в день — так семья и работает.',
  },
  {
    badge: 'Шаг 3',
    title: 'Деньги должны работать',
    body: 'Во вкладке «Дело» покупай улучшения и бизнесы. Бизнесы приносят деньги, пока тебя нет, — но касса переполняется за четыре часа, так что возвращайся.',
  },
  {
    badge: 'Шаг 4',
    title: 'Один в поле не воин',
    body: 'Зови друзей, вступай в клан, забирай задания дня и ежедневный бонус. Пропустишь день — серия сгорит и начнётся сначала.',
  },
];

export function Onboarding({ onDone }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-don-black/97 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-8 py-12">
        <div className="flex flex-col gap-4">
          <p className="text-[10px] tracking-[0.35em] text-don-blood-light uppercase">
            {step.badge}
          </p>

          <h2 className="text-4xl font-black tracking-[0.08em] text-don-gold uppercase">
            {step.title}
          </h2>

          <p className="text-base leading-relaxed text-neutral-300">{step.body}</p>
        </div>

        <div className="flex flex-col gap-4">
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
            className="w-full rounded-xl bg-gradient-to-r from-don-blood to-don-blood-deep px-4 py-3.5 text-base font-semibold tracking-wide text-don-gold-soft active:scale-95"
          >
            {last ? 'За работу' : 'Дальше'}
          </button>

          {!last && (
            <button
              type="button"
              onClick={onDone}
              className="text-xs tracking-wider text-neutral-600"
            >
              Пропустить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
