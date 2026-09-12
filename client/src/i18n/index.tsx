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

export type Translate = (text: string, values?: Record<string, string | number>) => string;

export function useT(): Translate {
  const lang = useContext(LangContext);

  return useMemo<Translate>(
    () => (text, values) => format(lang === 'en' ? (EN[text] ?? text) : text, values),
    [lang],
  );
}
