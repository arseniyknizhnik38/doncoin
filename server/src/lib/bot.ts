import { pickLang, type Lang } from '../config/i18n.js';

/**
 * Бот как дверь в игру.
 *
 * До этого бот молчал, а реклама вела прямо в мини-приложение ссылкой
 * `?startapp=`. Такой игрок для Telegram боту не писал и кнопку «Старт» не
 * нажимал — и бот не имеет права написать ему ни строчки. Из 407 купленных
 * игроков оказались достижимы двое, и возврат на второй день составил 3%:
 * позвать назад было некого.
 *
 * Поэтому реклама теперь ведёт на `?start=`: человек проходит через чат,
 * жмёт «Старт» — и с этого мига бот может напомнить ему про полную обойму,
 * сгорающую серию и идущий розыгрыш.
 */

/** Куда ведёт кнопка «Играть». */
export const APP_URL = process.env.APP_URL ?? 'https://doncoingame.com';

interface Greeting {
  text: string;
  button: string;
}

/**
 * Приветствие. Короткое намеренно: это не обучение, а дверь — чем быстрее
 * человек нажмёт кнопку, тем выше шанс, что он вообще дойдёт до игры.
 */
const GREETING: Record<Lang, Greeting> = {
  ru: {
    text:
      '🚬 Семья тебя ждала.\n\n' +
      'Ты пока никто: ни денег, ни имени, ни связей. Но у каждого дона было ' +
      'такое утро.\n\nЖми кнопку — и начнём с первой пачки.',
    button: '▶ Играть',
  },
  en: {
    text:
      '🚬 The family has been waiting.\n\n' +
      'Right now you are nobody: no money, no name, no connections. Every don ' +
      'started on a morning like this.\n\nHit the button and we begin.',
    button: '▶ Play',
  },
  zh: {
    text:
      '🚬 家族一直在等你。\n\n' +
      '你现在还是无名小卒：没钱、没名号、没人脉。可每位教父都是这么起家的。\n\n' +
      '点下面的按钮，我们开始。',
    button: '▶ 开始游戏',
  },
};

/** Полезная нагрузка из `/start <payload>`: рекламная метка или код кента. */
export function startPayload(text: string | undefined): string | null {
  if (!text) {
    return null;
  }

  const [command, ...rest] = text.trim().split(/\s+/);

  if (command !== '/start' && command !== `/start@${process.env.BOT_USERNAME ?? ''}`) {
    return null;
  }

  const payload = rest.join(' ').trim();

  // Тот же набор символов, что разрешает сам Telegram в start-параметре:
  // всё остальное прислал не он, и доверять этому нечего.
  return /^[A-Za-z0-9_-]{1,64}$/.test(payload) ? payload : null;
}

/**
 * Ответ на `/start`.
 *
 * Метка едет в кнопку запросом `?tag=`: кнопка `web_app` открывает наш адрес
 * напрямую, и start_param, который приходил из ссылки `?startapp=`, в
 * initData уже не попадёт. Иначе реклама привела бы игрока, которого мы не
 * смогли бы к ней привязать.
 */
export function greetingFor(languageCode: string | null | undefined, payload: string | null) {
  const lang = pickLang(languageCode);
  const greeting = GREETING[lang];
  const url = payload
    ? `${APP_URL}/?tag=${encodeURIComponent(payload)}`
    : `${APP_URL}/`;

  return {
    text: greeting.text,
    reply_markup: {
      inline_keyboard: [[{ text: greeting.button, web_app: { url } }]],
    },
  };
}
