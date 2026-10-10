import 'dotenv/config';

import { createApp } from './app.js';
import { startBotPolling } from './lib/botPolling.js';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT ?? 3000);

const server = createApp().listen(PORT, () => {
  console.log(`[server] DONCOIN API listening on http://localhost:${PORT}`);

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn(
      '[server] TELEGRAM_BOT_TOKEN не задан — POST /api/auth/telegram вернёт 503',
    );
  }

  // Опрос бота включается явным флагом: на стенде и в проверках токен
  // поддельный, и цикл только засорял бы вывод отказами Telegram.
  if (process.env.BOT_POLLING === '1' && process.env.TELEGRAM_BOT_TOKEN) {
    startBotPolling(process.env.TELEGRAM_BOT_TOKEN);
    console.log('[bot] опрос обновлений запущен');
  }
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
