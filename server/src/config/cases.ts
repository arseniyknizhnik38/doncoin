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
  zh?: string;
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
    title: { ru: 'Испытательный срок', en: 'Probation', zh: '考察期' },
    intro: {
      ru: 'Дон велел к тебе присмотреться. Есть дело — простое, но провалить его стыдно. Берёшься?',
      en: 'The don told me to keep an eye on you. Got a job — simple, but embarrassing to fail. In?',
      zh: '教父让我盯着你点。有个差事——简单，但办砸了丢人。干不干？',
    },
    steps: [
      {
        kind: 'earn',
        target: 2_000,
        say: {
          ru: 'Для начала — заработай 2 000. Покажи, что руки на месте.',
          en: 'First — earn 2,000. Show me your hands work.',
          zh: '先赚 2 000。让我看看你的手艺。',
        },
      },
      {
        kind: 'taps',
        target: 100,
        say: {
          ru: 'Теперь сто тапов подряд. Ритм — это уважение.',
          en: 'Now a hundred taps. Rhythm is respect.',
          zh: '现在连点一百下。节奏就是尊重。',
        },
      },
      {
        kind: 'upgrades',
        target: 1,
        say: {
          ru: 'И вложи в себя: купи любое улучшение. Дон любит, когда люди растут.',
          en: 'And invest in yourself: buy any upgrade. The don likes people who grow.',
          zh: '再给自己投点钱：随便买一个升级。教父喜欢上进的人。',
        },
      },
    ],
    outro: {
      ru: 'Испытание пройдено. Я замолвлю словечко. И это — меня здесь не было.',
      en: 'Probation passed. I will put in a word. And hey — I was never here.',
      zh: '考察通过。我会替你美言几句。还有——就当没见过我。',
    },
    rewardHours: 3,
    rewardTickets: 2,
  },
  {
    id: 'laundry',
    title: { ru: 'Грязные деньги', en: 'Dirty Money', zh: '脏钱' },
    intro: {
      ru: 'Слушай, деньги лежат грязные — надо прогнать через дело, тихо. Я бы сам, но мне после той истории с кассой не доверяют.',
      en: 'Listen, the money is dirty — needs to go through a business, quietly. I would do it myself, but after that till story they do not trust me.',
      zh: '听着，这笔钱不干净——得悄悄过一遍生意。本来我自己来，但自从钱柜那档子事，他们不信我了。',
    },
    steps: [
      {
        kind: 'earn',
        target: 25_000,
        say: {
          ru: 'Собери 25 000 — мелкими, чтобы не светиться.',
          en: 'Collect 25,000 — small bills, keep it quiet.',
          zh: '凑 25 000——要小票子，别张扬。',
        },
      },
      {
        kind: 'business',
        target: 1,
        say: {
          ru: 'Теперь подними любой бизнес на уровень. Этим деньгам нужна крыша.',
          en: 'Now level up any business. This money needs a roof.',
          zh: '现在把随便哪个产业升一级。这笔钱需要个幌子。',
        },
      },
      {
        kind: 'arcade',
        target: 1,
        say: {
          ru: 'И сходи на сбор выручки — заодно проверим твою ловкость.',
          en: 'And go on the Collection Run — let us see those hands.',
          zh: '再去跑一趟收账行动——顺便看看你的身手。',
        },
      },
    ],
    outro: {
      ru: 'Чисто сработано. Деньги пахнут прачечной, как положено. Не будем об этом.',
      en: 'Clean work. The money smells of laundry, as it should. We do not talk about it.',
      zh: '干得漂亮。钱现在一股洗衣房的味儿，正合适。这事儿就别提了。',
    },
    rewardHours: 4,
    rewardTickets: 2,
  },
  {
    id: 'discipline',
    title: { ru: 'День дисциплины', en: 'Discipline Day', zh: '纪律日' },
    intro: {
      ru: 'Дон говорит, у тебя талант. А талант без дисциплины — это я. Не повторяй моих ошибок.',
      en: 'The don says you have talent. Talent without discipline is me. Do not repeat my mistakes.',
      zh: '教父说你有天分。没纪律的天分就是我这样。别重蹈我的覆辙。',
    },
    steps: [
      {
        kind: 'daily',
        target: 1,
        say: {
          ru: 'Забери бонус дня. Каждый день, без пропусков. У меня так с диетой не вышло.',
          en: 'Collect the daily bonus. Every day, no misses. That is where my diet went wrong.',
          zh: '把每日奖励领了。天天领，一天都别落。我减肥就是栽在这上头。',
        },
      },
      {
        kind: 'taps',
        target: 500,
        say: {
          ru: 'Пятьсот тапов. Не за красоту — за характер.',
          en: 'Five hundred taps. Not for beauty — for character.',
          zh: '五百次点击。不为好看——为磨性子。',
        },
      },
      {
        kind: 'earn',
        target: 50_000,
        say: {
          ru: 'И доведи счёт: ещё 50 000. Дисциплина должна окупаться.',
          en: 'And finish the count: 50,000 more. Discipline should pay.',
          zh: '把账做满：再来 50 000。守纪律就该有回报。',
        },
      },
    ],
    outro: {
      ru: 'Вот это я понимаю. Дон будет доволен. Может, и мне пару слов про салаты скажешь.',
      en: 'Now that is what I call it. The don will be pleased. Maybe you talk to him about my salads.',
      zh: '这才像话。教父会满意的。回头替我说说沙拉那事呗。',
    },
    rewardHours: 5,
    rewardTickets: 2,
  },
  {
    id: 'expansion',
    title: { ru: 'Расширение', en: 'Expansion', zh: '扩张' },
    intro: {
      ru: 'Семья растёт, и точки должны расти. Дон спросил, кому доверить, — я назвал тебя. Не подведи нас обоих.',
      en: 'The family grows, and the spots must grow. The don asked who to trust — I named you. Do not fail us both.',
      zh: '家族在壮大，场子也得跟上。教父问交给谁放心——我报了你的名字。别让咱俩都下不来台。',
    },
    steps: [
      {
        kind: 'business',
        target: 3,
        say: {
          ru: 'Подними бизнесы на три уровня. Любые — город большой.',
          en: 'Raise your businesses by three levels. Any of them — the city is big.',
          zh: '把产业总共升三级。随便哪个——城市大得很。',
        },
      },
      {
        kind: 'earn',
        target: 150_000,
        say: {
          ru: 'Теперь покажи выручку: 150 000. Точки должны кормить.',
          en: 'Now show the take: 150,000. Spots must feed.',
          zh: '现在拿出业绩来：150 000。场子得养人。',
        },
      },
      {
        kind: 'arcade',
        target: 1,
        say: {
          ru: 'И на сбор выручки загляни — традиция.',
          en: 'And drop by the Collection Run — tradition.',
          zh: '再去收账行动转一圈——老规矩。',
        },
      },
    ],
    outro: {
      ru: 'Расширились. Дон кивнул. Молча — но кивнул, а это дорогого стоит.',
      en: 'Expanded. The don nodded. Silently — but he nodded, and that is worth a lot.',
      zh: '扩张成了。教父点头了。虽然没吭声——但点头了，这分量可不轻。',
    },
    rewardHours: 6,
    rewardTickets: 2,
  },
  {
    id: 'quiet-week',
    title: { ru: 'Тихая неделя', en: 'A Quiet Week', zh: '平静的一周' },
    intro: {
      ru: 'Наверху шумно, поэтому нам — тихо. Никаких приключений: работаем, копим, не отсвечиваем.',
      en: 'It is loud upstairs, so we stay quiet. No adventures: work, save, keep your head down.',
      zh: '上头风声紧，咱们就得安分。别惹事：干活、攒钱、别出风头。',
    },
    steps: [
      {
        kind: 'daily',
        target: 1,
        say: {
          ru: 'Бонус дня — забрать. Порядок начинается с мелочей.',
          en: 'Daily bonus — collect it. Order starts small.',
          zh: '每日奖励——领了。规矩从小事做起。',
        },
      },
      {
        kind: 'upgrades',
        target: 3,
        say: {
          ru: 'Три уровня улучшений. Вкладывай в себя, пока тихо.',
          en: 'Three upgrade levels. Invest in yourself while it is quiet.',
          zh: '三级升级。趁风平浪静，给自己加码。',
        },
      },
      {
        kind: 'earn',
        target: 300_000,
        say: {
          ru: 'И собери 300 000. Тихие недели — самые прибыльные, запомни.',
          en: 'And put together 300,000. Quiet weeks pay best, remember that.',
          zh: '再攒出 300 000。记住，越平静的一周越赚钱。',
        },
      },
    ],
    outro: {
      ru: 'Неделя прошла тихо, касса — громко. Ты далеко пойдёшь. Дальше меня уж точно.',
      en: 'The week went quietly, the till went loud. You will go far. Farther than me, that is certain.',
      zh: '这周平平静静，钱柜响得厉害。你会有大出息。反正肯定比我强。',
    },
    rewardHours: 8,
    rewardTickets: 2,
  },
];

export function pickCaseText(text: CaseText, language: string): string {
  if (language === 'zh') {
    return text.zh ?? text.en;
  }

  return language === 'en' ? text.en : text.ru;
}
