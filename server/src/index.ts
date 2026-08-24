import 'dotenv/config';

import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { prisma } from './lib/prisma.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 404 for unknown API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = app.listen(PORT, () => {
  console.log(`[server] DONCOIN API listening on http://localhost:${PORT}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
