import { mockTelegramEnv } from '@telegram-apps/sdk-react';

/**
 * Эмуляция окружения Telegram для локальной разработки без туннеля.
 * Включается только флагом VITE_TG_MOCK=1 в dev-режиме, поэтому обычный
 * `npm run dev` по-прежнему показывает «Тестовый режим (не в Telegram)».
 *
 * initData подписываются тем же фиктивным токеном, который задан в
 * server/.env.mock — тогда локальный сервер принимает их как настоящие и
 * игровой цикл работает целиком. Настоящий токен бота на клиент не попадает
 * никогда: в прод-сборке весь этот модуль вырезается.
 */
async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function signInitData(params: URLSearchParams, botToken: string) {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  params.set('hash', toHex(await hmacSha256(secretKey, dataCheckString)));
}

export async function applyTelegramMock(): Promise<void> {
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
  });

  const mockToken = import.meta.env.VITE_TG_MOCK_BOT_TOKEN;

  if (mockToken) {
    await signInitData(initData, mockToken);
  } else {
    // Без токена подпись заведомо неверная — сервер ответит 401.
    initData.set('hash', '0'.repeat(64));
  }

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
