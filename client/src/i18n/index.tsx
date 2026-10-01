import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EN } from './en';
import { ZH } from './zh';

export type Lang = 'ru' | 'en' | 'zh';

/** Языки, между которыми можно переключиться в настройках. */
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

/**
 * Перевод по исходной строке.
 *
 * Ключ — сам русский текст, а не выдуманный идентификатор вроде
 * `game.tab.play`. Так код остаётся читаемым (`t('Игра')` понятно без
 * заглядывания в словарь), а главное — непереведённая строка не превращается
 * в пустоту или в имя ключа на экране: китайский падает в английский,
 * английский — в русский.
 */
const LangContext = createContext<Lang>('ru');

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Подстановка значений: `«{n} тапов»` → `«500 тапов»`. */
function format(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * Строки, которые сервер собирает с числами внутри: «Сделать 4 000 тапов»,
 * «123 за тап». Точным ключом их не поймать, поэтому ловим шаблоном. Список
 * короткий и закрытый — это описания заданий дня и уровней улучшений.
 * Числа отформатированы ru-RU, разряды разделяет неразрывный пробел.
 */
const DYNAMIC_EN: [RegExp, string][] = [
  [/^Сделать ([\d  .,]+) тапов$/, 'Tap $1 times'],
  [/^Заработать ([\d  .,]+) DONC$/, 'Earn $1 DONC'],
  [/^Купить ([\d  .,]+) уровня улучшений$/, 'Buy $1 upgrade levels'],
  [/^Купить ([\d  .,]+) уровней улучшений$/, 'Buy $1 upgrade levels'],
  [/^Внести в кассу ([\d  .,]+) DONC$/, 'Put $1 DONC into the treasury'],
  [/^Использовать «Полную обойму» (\d+) раза$/, 'Use Full Clip $1 times'],
  [/^Использовать «Разгон» (\d+) раза$/, 'Use Rush $1 times'],
  [/^([\d  .,]+) за тап$/, '$1 per tap'],
  [/^([\d  .,]+) тапов в обойме$/, '$1 taps per clip'],
  [/^\+([\d  .,]+) тапов в минуту$/, '+$1 taps per minute'],
  [/^Собрать серию из (\d+) дней$/, 'Build a $1-day streak'],
  [/^Привести (\d+) друзей$/, 'Bring $1 friends'],
  [/^Дон в отставке ×(\d+)$/, 'Retired Don ×$1'],
  [/^×(\d+) за тап на (\d+) секунд$/, '×$1 per tap for $2 seconds'],
];

const DYNAMIC_ZH: [RegExp, string][] = [
  [/^Сделать ([\d  .,]+) тапов$/, '点击 $1 次'],
  [/^Заработать ([\d  .,]+) DONC$/, '赚取 $1 DONC'],
  [/^Купить ([\d  .,]+) уровня улучшений$/, '购买 $1 级升级'],
  [/^Купить ([\d  .,]+) уровней улучшений$/, '购买 $1 级升级'],
  [/^Внести в кассу ([\d  .,]+) DONC$/, '向金库上供 $1 DONC'],
  [/^Использовать «Полную обойму» (\d+) раза$/, '使用「满弹匣」$1 次'],
  [/^Использовать «Разгон» (\d+) раза$/, '使用「加速」$1 次'],
  [/^([\d  .,]+) за тап$/, '每次点击 $1'],
  [/^([\d  .,]+) тапов в обойме$/, '弹匣容量 $1'],
  [/^\+([\d  .,]+) тапов в минуту$/, '每分钟恢复 $1'],
  [/^Собрать серию из (\d+) дней$/, '连续 $1 天不间断'],
  [/^Привести (\d+) друзей$/, '拉来 $1 位好友'],
  [/^Дон в отставке ×(\d+)$/, '退隐教父 ×$1'],
  [/^×(\d+) за тап на (\d+) секунд$/, '$2 秒内每次点击 ×$1'],
];

const DICTS: Record<'en' | 'zh', Record<string, string>> = { en: EN, zh: ZH };
const DYNAMICS: Record<'en' | 'zh', [RegExp, string][]> = { en: DYNAMIC_EN, zh: DYNAMIC_ZH };

function translateTo(lang: 'en' | 'zh', text: string): string {
  const dict = DICTS[lang];
  const exact = dict[text];

  if (exact !== undefined) {
    return exact;
  }

  // Титул со звёздами («Солдат ★») приходит одной строкой — переводим
  // титул, звёзды оставляем.
  const ranked = /^(.+?) (★+)$/.exec(text);

  if (ranked && dict[ranked[1]!] !== undefined) {
    return `${dict[ranked[1]!]} ${ranked[2]}`;
  }

  for (const [pattern, replacement] of DYNAMICS[lang]) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }

  // Дыра в китайском словаре закрывается английским: он читается почти
  // везде, в отличие от русского.
  if (lang === 'zh') {
    return translateTo('en', text);
  }

  return text;
}

export type Translate = (text: string, values?: Record<string, string | number>) => string;

export function useT(): Translate {
  const lang = useContext(LangContext);

  return useMemo<Translate>(
    () => (text, values) => format(lang === 'ru' ? text : translateTo(lang, text), values),
    [lang],
  );
}
