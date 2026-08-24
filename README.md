# DONCOIN

> START AS NOBODY. BECOME THE DON.

Full-stack монорепозиторий на npm workspaces:

| Пакет    | Стек                                       | Dev-порт |
| -------- | ------------------------------------------ | -------- |
| `client` | React 19 + TypeScript + Vite + Tailwind v4 | `5173`   |
| `server` | Node.js + Express 5 + TypeScript (tsx)     | `3000`   |

## Требования

- Node.js >= 20 (проверено на 24)
- npm >= 10

## Установка

```bash
npm install
```

Одна команда в корне ставит зависимости обоих воркспейсов.

## Запуск в режиме разработки

```bash
npm run dev
```

Через `concurrently` поднимаются одновременно:

- API — http://localhost:3000 (автоперезагрузка через `tsx watch`)
- UI — http://localhost:5173 (Vite HMR)

Vite проксирует `/api/*` на сервер, поэтому из фронтенда можно ходить на
относительные пути (`fetch('/api/health')`) без CORS-настроек.

Запустить что-то одно:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

## Сборка

```bash
npm run build
```

- `server` → `server/dist` (компиляция `tsc`)
- `client` → `client/dist` (статика Vite)

Запуск собранного API:

```bash
npm start
```

## API

| Метод | Путь          | Ответ               |
| ----- | ------------- | ------------------- |
| `GET` | `/api/health` | `{ "status": "ok" }` |

Проверка:

```bash
curl http://localhost:3000/api/health
```

## Переменные окружения

Скопируйте `server/.env.example` в `server/.env` и задайте `PORT` при
необходимости. Файлы `.env` в git не попадают.

## База данных (PostgreSQL + Prisma 7)

Схема: [`server/prisma/schema.prisma`](server/prisma/schema.prisma) — модель `User`
(`id`, `telegramId` unique, `username?`, `firstName?`, `createdAt`, `updatedAt`).

### 1. Строка подключения

Откройте `server/.env` и замените значение в кавычках на строку из Neon
(Dashboard → проект → **Connect** → Connection string):

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=verify-full"
```

Файл `server/.env` исключён из git. Шаблон без секретов — `server/.env.example`.

> В Prisma 7 `.env` не читается автоматически: его загружает
> `server/prisma.config.ts` (`import "dotenv/config"`), оттуда же CLI берёт
> `datasource.url`. Рантайм-сервер грузит `.env` в `server/src/index.ts`.

### 2. Применить схему к базе

```bash
npm run db:migrate
```

Создаст SQL-миграцию в `server/prisma/migrations/`, применит её к базе и
перегенерирует Prisma Client. Миграции коммитятся в git.

Быстрая альтернатива для прототипа, без файлов миграций:

```bash
npm run db:push -w server
```

На проде/CI применение уже созданных миграций:

```bash
npm run db:deploy -w server
```

### 3. Прочее

Перегенерировать клиент (запускается автоматически в `dev` и `build`):

```bash
npm run db:generate
```

Просмотр данных в браузере:

```bash
npm run db:studio
```

### Использование клиента в коде

Клиент — синглтон в [`server/src/lib/prisma.ts`](server/src/lib/prisma.ts)
(Prisma 7 работает через driver adapter `@prisma/adapter-pg`):

```ts
import { prisma } from './lib/prisma.js';

const user = await prisma.user.upsert({
  where: { telegramId },
  update: { username, firstName },
  create: { telegramId, username, firstName },
});
```

Сгенерированный клиент лежит в `server/src/generated/prisma/` и в git не
попадает — после `git clone` выполните `npm install && npm run db:generate`.
