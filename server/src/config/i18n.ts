/**
 * Два языка игры.
 *
 * Русский — рынок, с которого начинали. Английский — всё остальное, и
 * именно он открывает Азию, откуда пришла основная масса игроков и к
 * Ноткоину, и к Хомяку. Без него игра упирается в потолок русскоязычной
 * аудитории независимо от бюджета.
 *
 * Языков ровно два и третьего не планируется: каждый следующий удваивает
 * работу над каждой строкой, а выигрыш быстро сходит на нет — английского
 * хватает везде, кроме СНГ.
 */
export type Lang = 'ru' | 'en';

/** Текст на обоих языках. */
export interface Text {
  ru: string;
  en: string;
}

/**
 * Язык по коду из Telegram.
 *
 * Русский получают только те, у кого он в настройках. Всем остальным —
 * английский: игрок из Индонезии с русским интерфейсом закроет приложение,
 * не поняв, чего от него хотят, а англоязычный текст читают почти везде.
 */
export function pickLang(code: string | null | undefined): Lang {
  return code?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** Достаёт нужный язык. */
/** Язык, уже записанный у игрока: в базе строка, доверяем только двум значениям. */
export function pickLangStored(stored: string): Lang {
  return stored === 'en' ? 'en' : 'ru';
}

export function t(text: Text, lang: Lang): string {
  return text[lang];
}

/**
 * Подставляет значения в строку: `«{n} тапов»` → `«500 тапов»`.
 *
 * Свой подстановщик, а не библиотека: нужен ровно этот случай, а лишняя
 * зависимость в мини-аппе — это лишние килобайты у каждого игрока.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/** Текст с подстановкой — самый частый случай в заданиях и ошибках. */
export function tf(
  text: Text,
  lang: Lang,
  values: Record<string, string | number>,
): string {
  return format(text[lang], values);
}
