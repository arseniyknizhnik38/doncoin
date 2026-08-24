import 'dotenv/config';

import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT ?? 3000);

const server = createApp().listen(PORT, () => {
  console.log(`[server] DONCOIN API listening on http://localhost:${PORT}`);

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn(
      '[server] TELEGRAM_BOT_TOKEN не задан — POST /api/auth/telegram вернёт 503',
    );
  }
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
