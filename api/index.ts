// Точка входа serverless-функции Vercel: один Express-обработчик на все
// маршруты /api/* (см. rewrites в vercel.json).
// Локально этот файл не используется — там работает server/src/index.ts.
import { createApp } from '../server/src/app.js';

export default createApp();
