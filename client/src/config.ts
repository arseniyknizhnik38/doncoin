/**
 * Ссылка на Mini App, к которой дописывается ?startapp=КОД.
 * Задаётся переменной VITE_MINI_APP_LINK (в Vercel — Environment Variables).
 *
 * Для приглашений нужен прямой адрес Mini App вида
 * https://t.me/ИМЯ_БОТА/ИМЯ_ПРИЛОЖЕНИЯ — он создаётся командой /newapp
 * в BotFather. Кнопка меню реферальный код не передаёт.
 */
export const MINI_APP_LINK: string =
  import.meta.env.VITE_MINI_APP_LINK ?? 'https://t.me/DonCoinTapGameBot';

export const buildReferralLink = (code: string) =>
  `${MINI_APP_LINK}?startapp=${code}`;
