/**
 * Языки игры.
 *
 * Русский — рынок, с которого начинали. Английский открывает весь мир.
 * Китайский добавлен решением владельца под азиатскую волну: у Ноткоина
 * и Хомяка Азия давала основную массу игроков.
 *
 * Китайский в серверных текстах необязателен: где перевода нет, игрок
 * получает английский — он в Азии читается, в отличие от русского.
 */
export type Lang = 'ru' | 'en' | 'zh';

/** Текст на языках игры. Китайский — по мере перевода. */
export interface Text {
  ru: string;
  en: string;
  zh?: string;
}

/**
 * Язык по коду из Telegram.
 *
 * Русский получают только те, у кого он в настройках, китайский — все
 * варианты zh (zh-hans, zh-TW…). Всем остальным — английский: игрок из
 * Индонезии с русским интерфейсом закроет приложение, не поняв, чего от
 * него хотят.
 */
export function pickLang(code: string | null | undefined): Lang {
  const lower = code?.toLowerCase() ?? '';

  if (lower.startsWith('ru')) {
    return 'ru';
  }

  if (lower.startsWith('zh')) {
    return 'zh';
  }

  return 'en';
}

/** Язык, уже записанный у игрока: в базе строка, доверяем только своим значениям. */
export function pickLangStored(stored: string): Lang {
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

export function t(text: Text, lang: Lang): string {
  if (lang === 'zh') {
    return text.zh ?? text.en;
  }

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
  return format(t(text, lang), values);
}
