import {
  init as initSdk,
  initData,
  isTMA,
  miniApp,
  viewport,
} from '@telegram-apps/sdk-react';

/**
 * Палитра DONCOIN, которую отдаём нативным элементам Telegram (шапка, фон,
 * нижняя панель), чтобы вместо светлой темы клиента был наш тёмный фон.
 */
export const TELEGRAM_COLORS = {
  background: '#0A0A0A',
  header: '#0A0A0A',
  bottomBar: '#0A0A0A',
} as const;

let insideTelegram = false;

/** true — приложение запущено внутри Telegram и SDK проинициализирован. */
export function isTelegramEnv(): boolean {
  return insideTelegram;
}

/** `stableHeight` → `--tg-viewport-stable-height` и т.д. */
function cssVarName(key: string): string {
  return `--tg-viewport-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}

/**
 * Инициализация Telegram Mini Apps SDK. Вызывается один раз при старте,
 * до рендера React. Вне Telegram молча возвращает false — приложение
 * продолжает работать в браузере как обычная страница.
 */
export function initTelegram(): boolean {
  // Синхронная проверка launch-параметров: в обычном браузере их нет.
  if (!isTMA()) {
    return false;
  }

  try {
    initSdk();
    // Данные пользователя из launch-параметров -> сигнал initData.user.
    initData.restore();
    insideTelegram = true;
  } catch (error) {
    // Битые launch-параметры: деградируем до обычного браузерного режима,
    // чтобы приложение не падало белым экраном.
    console.warn('[telegram] SDK init failed', error);
    return false;
  }

  try {
    applyTelegramUi();
  } catch (error) {
    console.warn('[telegram] UI setup failed', error);
  }

  return true;
}

/** Разворот на весь экран и наши цвета вместо стандартной темы Telegram. */
function applyTelegramUi(): void {
  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync();

    // 2) тёмный фон вместо светлой темы Telegram
    miniApp.setBackgroundColor.ifAvailable(TELEGRAM_COLORS.background);
    miniApp.setHeaderColor.ifAvailable(TELEGRAM_COLORS.header);
    miniApp.setBottomBarColor.ifAvailable(TELEGRAM_COLORS.bottomBar);
  }

  // 1) растягиваем окно на весь экран Telegram
  viewport.expand.ifAvailable();

  // Монтируем viewport ради CSS-переменных с реальной высотой окна:
  // на мобильных 100vh врёт из-за панелей клиента.
  if (viewport.mount.isAvailable()) {
    viewport
      .mount()
      .then(() => {
        viewport.bindCssVars.ifAvailable(cssVarName);
      })
      .catch((error: unknown) => {
        console.warn('[telegram] viewport mount failed', error);
      });
  }

  // Сообщаем клиенту, что интерфейс готов и можно убирать заглушку загрузки.
  miniApp.ready.ifAvailable();
}
