import { mockTelegramEnv } from '@telegram-apps/sdk-react';

/**
 * Опциональная эмуляция окружения Telegram для локальной разработки без
 * туннеля. Включается только флагом VITE_TG_MOCK=1 в dev-режиме, поэтому
 * обычный `npm run dev` по-прежнему показывает «Тестовый режим (не в Telegram)».
 *
 * Реальные данные пользователя и подпись здесь ненастоящие — для проверки
 * серверной валидации initData нужен запуск внутри Telegram.
 */
export function applyTelegramMock(): void {
  if (!import.meta.env.DEV || import.meta.env.VITE_TG_MOCK !== '1') {
    return;
  }

  const initData = new URLSearchParams({
    user: JSON.stringify({
      id: 123456789,
      first_name: 'Vito',
      last_name: 'Corleone',
      username: 'don_vito',
      language_code: 'ru',
    }),
    auth_date: Math.floor(Date.now() / 1000).toString(),
    query_id: 'MOCK_QUERY_ID',
    signature: 'mock_signature',
    hash: '0'.repeat(64),
  });

  mockTelegramEnv({
    launchParams: {
      tgWebAppData: initData,
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'tdesktop',
      tgWebAppThemeParams: {},
    },
    onEvent([method, params], next) {
      // Видно, что именно приложение просит у клиента Telegram.
      console.debug('[telegram:mock] ->', method, params ?? '');
      next();
    },
  });

  console.info('[telegram] запущен мок окружения (VITE_TG_MOCK=1)');
}
