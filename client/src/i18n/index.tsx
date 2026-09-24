import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EN } from './en';

export type Lang = 'ru' | 'en';

/**
 * Перевод по исходной строке.
 *
 * Ключ — сам русский текст, а не выдуманный идентификатор вроде
 * `game.tab.play`. Так код остаётся читаемым (`t('Игра')` понятно без
 * заглядывания в словарь), а главное — непереведённая строка не превращается
 * в пустоту или в имя ключа на экране: она просто остаётся русской.
 *
 * Для игры с двумя языками это выгоднее, чем идентификаторы: их пришлось бы
 * придумать четыре с половиной сотни штук, и каждый стал бы поводом ошибиться.
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
const DYNAMIC: [RegExp, string][] = [
  [/^Сделать ([\d  .,]+) тапов$/, 'Tap $1 times'],
  [/^Заработать ([\d  .,]+) DONC$/, 'Earn $1 DONC'],
  [/^Купить ([\d  .,]+) уровня улучшений$/, 'Buy $1 upgrade levels'],
  [/^Купить ([\d  .,]+) уровней улучшений$/, 'Buy $1 upgrade levels'],
  [/^Внести в кассу ([\d  .,]+) DONC$/, 'Put $1 DONC into the treasury'],
  [/^Использовать «Полную обойму» (\d+) раза$/, 'Use Full Clip $1 times'],
  [/^Использовать «Разгон» (\d+) раза$/, 'Use Rush $1 times'],
  [/^([\d  .,]+) за тап$/, '$1 per tap'],
  [/^([\d  .,]+) тапов в обойме$/, '$1 taps per clip'],
  [/^\+([\d  .,]+) тапов в минуту$/, '+$1 taps per minute'],
  [/^Собрать серию из (\d+) дней$/, 'Build a $1-day streak'],
  [/^Привести (\d+) друзей$/, 'Bring $1 friends'],
  [/^Дон в отставке ×(\d+)$/, 'Retired Don ×$1'],
  [/^×(\d+) за тап на (\d+) секунд$/, '×$1 per tap for $2 seconds'],
];

function translateEn(text: string): string {
  const exact = EN[text];

  if (exact !== undefined) {
    return exact;
  }

  // Титул со звёздами («Солдат ★») приходит одной строкой — переводим
  // титул, звёзды оставляем.
  const ranked = /^(.+?) (★+)$/.exec(text);

  if (ranked && EN[ranked[1]!] !== undefined) {
    return `${EN[ranked[1]!]} ${ranked[2]}`;
  }

  for (const [pattern, replacement] of DYNAMIC) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement);
    }
  }

  return text;
}

export type Translate = (text: string, values?: Record<string, string | number>) => string;

export function useT(): Translate {
  const lang = useContext(LangContext);

  return useMemo<Translate>(
    () => (text, values) => format(lang === 'en' ? translateEn(text) : text, values),
    [lang],
  );
}
