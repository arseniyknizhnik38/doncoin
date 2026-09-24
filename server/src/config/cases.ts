/**
 * «Дела семьи» — сюжетные поручения от Толстого Бобби.
 *
 * Механически дело — три шага из уже существующих счётчиков игры,
 * связанные историей. Никаких новых систем: вся ценность в репликах
 * Бобби и в том, что трёхшаговое дело само растягивается на пару дней.
 *
 * Тексты хранятся парой языков прямо здесь: реплики собирает сервер,
 * как ленту и уведомления, — клиентскому словарю их не поймать.
 */

export type CaseStepKind =
  /** Заработать монет с момента начала шага. */
  | 'earn'
  /** Сделать тапов с момента начала шага. */
  | 'taps'
  /** Купить уровней улучшений. */
  | 'upgrades'
  /** Поднять уровней бизнесов. */
  | 'business'
  /** Забрать бонус дня после начала шага. */
  | 'daily'
  /** Сходить на «Сбор выручки» после начала шага. */
  | 'arcade';

export interface CaseText {
  ru: string;
  en: string;
}

export interface CaseStep {
  kind: CaseStepKind;
  target: number;
  /** Реплика Бобби при выдаче шага. */
  say: CaseText;
}

export interface CaseDefinition {
  id: string;
  title: CaseText;
  /** Реплика при предложении дела. */
  intro: CaseText;
  steps: CaseStep[];
  /** Эпилог — при закрытии дела. */
  outro: CaseText;
  /** Награда: часы активного дохода игрока, как у заданий дня. */
  rewardHours: number;
  /** Билетов розыгрыша за закрытое дело. */
  rewardTickets: number;
}

/** Пауза между делами: дело — событие, а не конвейер. */
export const CASE_COOLDOWN_HOURS = 36;

export const CASES: CaseDefinition[] = [
  {
    id: 'probation',
    title: { ru: 'Испытательный срок', en: 'Probation' },
    intro: {
      ru: 'Дон велел к тебе присмотреться. Есть дело — простое, но провалить его стыдно. Берёшься?',
      en: 'The don told me to keep an eye on you. Got a job — simple, but embarrassing to fail. In?',
    },
    steps: [
      {
        kind: 'earn',
        target: 2_000,
        say: {
          ru: 'Для начала — заработай 2 000. Покажи, что руки на месте.',
          en: 'First — earn 2,000. Show me your hands work.',
        },
      },
      {
        kind: 'taps',
        target: 100,
        say: {
          ru: 'Теперь сто тапов подряд. Ритм — это уважение.',
          en: 'Now a hundred taps. Rhythm is respect.',
        },
      },
      {
        kind: 'upgrades',
        target: 1,
        say: {
          ru: 'И вложи в себя: купи любое улучшение. Дон любит, когда люди растут.',
          en: 'And invest in yourself: buy any upgrade. The don likes people who grow.',
        },
      },
    ],
    outro: {
      ru: 'Испытание пройдено. Я замолвлю словечко. И это — меня здесь не было.',
      en: 'Probation passed. I will put in a word. And hey — I was never here.',
    },
    rewardHours: 3,
    rewardTickets: 2,
  },
  {
    id: 'laundry',
    title: { ru: 'Грязные деньги', en: 'Dirty Money' },
    intro: {
      ru: 'Слушай, деньги лежат грязные — надо прогнать через дело, тихо. Я бы сам, но мне после той истории с кассой не доверяют.',
      en: 'Listen, the money is dirty — needs to go through a business, quietly. I would do it myself, but after that till story they do not trust me.',
    },
    steps: [
      {
        kind: 'earn',
        target: 25_000,
        say: {
          ru: 'Собери 25 000 — мелкими, чтобы не светиться.',
          en: 'Collect 25,000 — small bills, keep it quiet.',
        },
      },
      {
        kind: 'business',
        target: 1,
        say: {
          ru: 'Теперь подними любой бизнес на уровень. Этим деньгам нужна крыша.',
          en: 'Now level up any business. This money needs a roof.',
        },
      },
      {
        kind: 'arcade',
        target: 1,
        say: {
          ru: 'И сходи на сбор выручки — заодно проверим твою ловкость.',
          en: 'And go on the Collection Run — let us see those hands.',
        },
      },
    ],
    outro: {
      ru: 'Чисто сработано. Деньги пахнут прачечной, как положено. Не будем об этом.',
      en: 'Clean work. The money smells of laundry, as it should. We do not talk about it.',
    },
    rewardHours: 4,
    rewardTickets: 2,
  },
  {
    id: 'discipline',
    title: { ru: 'День дисциплины', en: 'Discipline Day' },
    intro: {
      ru: 'Дон говорит, у тебя талант. А талант без дисциплины — это я. Не повторяй моих ошибок.',
      en: 'The don says you have talent. Talent without discipline is me. Do not repeat my mistakes.',
    },
    steps: [
      {
        kind: 'daily',
        target: 1,
        say: {
          ru: 'Забери бонус дня. Каждый день, без пропусков. У меня так с диетой не вышло.',
          en: 'Collect the daily bonus. Every day, no misses. That is where my diet went wrong.',
        },
      },
      {
        kind: 'taps',
        target: 500,
        say: {
          ru: 'Пятьсот тапов. Не за красоту — за характер.',
          en: 'Five hundred taps. Not for beauty — for character.',
        },
      },
      {
        kind: 'earn',
        target: 50_000,
        say: {
          ru: 'И доведи счёт: ещё 50 000. Дисциплина должна окупаться.',
          en: 'And finish the count: 50,000 more. Discipline should pay.',
        },
      },
    ],
    outro: {
      ru: 'Вот это я понимаю. Дон будет доволен. Может, и мне пару слов про салаты скажешь.',
      en: 'Now that is what I call it. The don will be pleased. Maybe you talk to him about my salads.',
    },
    rewardHours: 5,
    rewardTickets: 2,
  },
  {
    id: 'expansion',
    title: { ru: 'Расширение', en: 'Expansion' },
    intro: {
      ru: 'Семья растёт, и точки должны расти. Дон спросил, кому доверить, — я назвал тебя. Не подведи нас обоих.',
      en: 'The family grows, and the spots must grow. The don asked who to trust — I named you. Do not fail us both.',
    },
    steps: [
      {
        kind: 'business',
        target: 3,
        say: {
          ru: 'Подними бизнесы на три уровня. Любые — город большой.',
          en: 'Raise your businesses by three levels. Any of them — the city is big.',
        },
      },
      {
        kind: 'earn',
        target: 150_000,
        say: {
          ru: 'Теперь покажи выручку: 150 000. Точки должны кормить.',
          en: 'Now show the take: 150,000. Spots must feed.',
        },
      },
      {
        kind: 'arcade',
        target: 1,
        say: {
          ru: 'И на сбор выручки загляни — традиция.',
          en: 'And drop by the Collection Run — tradition.',
        },
      },
    ],
    outro: {
      ru: 'Расширились. Дон кивнул. Молча — но кивнул, а это дорогого стоит.',
      en: 'Expanded. The don nodded. Silently — but he nodded, and that is worth a lot.',
    },
    rewardHours: 6,
    rewardTickets: 2,
  },
  {
    id: 'quiet-week',
    title: { ru: 'Тихая неделя', en: 'A Quiet Week' },
    intro: {
      ru: 'Наверху шумно, поэтому нам — тихо. Никаких приключений: работаем, копим, не отсвечиваем.',
      en: 'It is loud upstairs, so we stay quiet. No adventures: work, save, keep your head down.',
    },
    steps: [
      {
        kind: 'daily',
        target: 1,
        say: {
          ru: 'Бонус дня — забрать. Порядок начинается с мелочей.',
          en: 'Daily bonus — collect it. Order starts small.',
        },
      },
      {
        kind: 'upgrades',
        target: 3,
        say: {
          ru: 'Три уровня улучшений. Вкладывай в себя, пока тихо.',
          en: 'Three upgrade levels. Invest in yourself while it is quiet.',
        },
      },
      {
        kind: 'earn',
        target: 300_000,
        say: {
          ru: 'И собери 300 000. Тихие недели — самые прибыльные, запомни.',
          en: 'And put together 300,000. Quiet weeks pay best, remember that.',
        },
      },
    ],
    outro: {
      ru: 'Неделя прошла тихо, касса — громко. Ты далеко пойдёшь. Дальше меня уж точно.',
      en: 'The week went quietly, the till went loud. You will go far. Farther than me, that is certain.',
    },
    rewardHours: 8,
    rewardTickets: 2,
  },
];

export function pickCaseText(text: CaseText, language: string): string {
  return language === 'en' ? text.en : text.ru;
}
