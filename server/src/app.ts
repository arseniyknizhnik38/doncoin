import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { BusinessError } from './lib/businesses.js';
import { ClanError } from './lib/clans.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { businessesRouter } from './routes/businesses.js';
import { clansRouter } from './routes/clans.js';
import { dailyRouter } from './routes/daily.js';
import { favorsRouter } from './routes/favors.js';
import { gameRouter } from './routes/game.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { referralsRouter } from './routes/referrals.js';
import { tasksRouter } from './routes/tasks.js';
import { upgradesRouter } from './routes/upgrades.js';

/**
 * Express-приложение без вызова listen — используется и локальным сервером
 * (src/index.ts), и serverless-функцией Vercel (api/index.ts).
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/game', gameRouter);
  app.use('/api/referrals', referralsRouter);
  app.use('/api/upgrades', upgradesRouter);
  app.use('/api/businesses', businessesRouter);
  app.use('/api/clans', clansRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/favors', favorsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/tasks', tasksRouter);

  // 404 for unknown API routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Ошибки обработчиков (включая асинхронные — Express 5 их пробрасывает сюда).
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Ошибки игровых правил несут собственный статус и код — их текст
    // предназначен игроку. Всё остальное наружу не раскрываем.
    if (error instanceof BusinessError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    if (error instanceof ClanError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    // У ошибок парсера тела есть свой статус (битый JSON — это 400, не 500).
    const status = (error as { status?: number }).status ?? 500;

    if (status >= 500) {
      console.error('[server] unhandled error', error);
    }

    res.status(status).json({
      error: status === 400 ? 'Некорректное тело запроса' : 'Internal Server Error',
    });
  });

  return app;
}
