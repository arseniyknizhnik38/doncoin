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

## Telegram Mini App

Пакет: [`@telegram-apps/sdk-react`](https://docs.telegram-mini-apps.com/) 3.3.9 —
официальный React-биндинг платформы Telegram Mini Apps.

Инициализация — [`client/src/telegram/init.ts`](client/src/telegram/init.ts),
вызывается в `main.tsx` до рендера React:

| Что делает                                   | Метод SDK                                        |
| -------------------------------------------- | ------------------------------------------------ |
| Разворачивает окно на весь экран              | `viewport.expand()`                              |
| Красит фон, шапку и нижнюю панель в `#0A0A0A` | `miniApp.setBackgroundColor/HeaderColor/BottomBarColor` |
| Отдаёт реальную высоту окна в CSS             | `viewport.bindCssVars()` → `--tg-viewport-*`     |
| Сообщает клиенту о готовности UI              | `miniApp.ready()`                                |
| Данные пользователя                           | `initData.restore()` → сигнал `initData.user`    |

Вне Telegram `isTMA()` возвращает false, SDK не инициализируется, страница
показывает «Тестовый режим (не в Telegram)». Ошибки SDK перехватываются —
приложение деградирует до браузерного режима, а не падает белым экраном.

Имя пользователя берётся хуком
[`useTelegram()`](client/src/telegram/useTelegram.ts).

### Быстрая проверка без Telegram (мок)

```bash
npm run dev:mock
```

Подставляет фиктивное окружение Telegram (`mockTelegramEnv`), страница
показывает тестового пользователя «Vito Corleone», а в консоли видны команды,
уходящие клиенту (`web_app_expand`, `web_app_set_background_color`, …).
Флаг живёт в `client/.env.mock`, в прод-сборку код мока не попадает.

Мок не проверяет подпись initData — для этого нужен запуск в настоящем Telegram.

### Как протестировать внутри настоящего Telegram

Telegram открывает Mini App только по **публичному HTTPS-адресу**, поэтому
`localhost` напрямую не подойдёт — нужен туннель.

**1. Поднять приложение локально**

```bash
npm run dev
```

**2. Пробросить порт 5173 наружу по HTTPS** (в отдельном терминале):

```bash
ssh -R 80:localhost:5173 nokey@localhost.run
```

Команда выведет адрес вида `https://911a9c7077d4fe.lhr.life`. Аккаунт и ключи
не нужны, туннель идёт по ssh (порт 22) и проходит через VPN/прокси.

Другие варианты, если этот недоступен:

| Сервис | Команда | Замечание |
| --- | --- | --- |
| localhost.run | `ssh -R 80:localhost:5173 nokey@localhost.run` | без регистрации, без заглушек |
| pinggy | `ssh -p 443 -R0:localhost:5173 a.pinggy.io` | работает через 443, сессия 60 мин |
| cloudflared | `npx cloudflared tunnel --url http://localhost:5173` | нужен **порт 7844** (UDP или TCP) |
| ngrok | `ngrok http 5173` | нужен бесплатный аккаунт + токен |
| localtunnel | `npx localtunnel --port 5173` | **не годится**: показывает браузерам страницу-заглушку, Telegram увидит её вместо приложения |

> **Если включён VPN/прокси в режиме TUN + fake-IP** (все домены резолвятся в
> `198.18.x.x`), cloudflared не поднимется: он ходит на порт 7844, который такие
> прокси обычно не пропускают — в логах будет `QUIC connection failed`, а с
> `--protocol http2` — `TLS handshake with edge error: EOF`. Лечится либо
> отключением прокси, либо ssh-туннелем из таблицы выше.

**3. Хост туннеля уже разрешён.** Vite отвечает 403 Blocked request на чужой
Host-заголовок, поэтому в `client/vite.config.ts` заранее прописан
`server.allowedHosts` для доменов localhost.run, serveo, pinggy, cloudflared,
ngrok и localtunnel. Другой сервис — добавьте его домен в этот список.

Если через туннель не работает HMR, допишите туда же `hmr: { clientPort: 443 }`.

**4. Создать бота и Mini App в [@BotFather](https://t.me/BotFather)**

- `/newbot` → имя и username бота → получите токен (он понадобится позже для
  серверной валидации initData);
- `/newapp` → выбрать бота → название, описание, картинку 640×360 → **Web App
  URL**: вставить HTTPS-адрес туннеля;
- BotFather вернёт ссылку вида `https://t.me/ваш_бот/имя_приложения`.

Быстрее без `/newapp`: `/mybots` → бот → **Bot Settings → Menu Button → Edit
menu button URL** → адрес туннеля. Тогда Mini App открывается кнопкой меню в
чате с ботом.

**5. Открыть ссылку в Telegram** — на телефоне или в Telegram Desktop.
Должно быть видно: приложение развёрнуто на весь экран, фон тёмный (не белый),
на карточке — ваше настоящее имя из Telegram.

### Отладка внутри Telegram

- **Telegram Desktop:** Настройки → Продвинутые → Экспериментальные настройки →
  включить **Enable webview inspecting**, затем правый клик по Mini App →
  «Inspect».
- **Android:** включить отладку по USB и открыть `chrome://inspect` на
  компьютере.
- **iOS:** Safari → Разработка → устройство (нужен Web Inspector в настройках
  Safari на телефоне).

Если в Telegram страница пустая — почти всегда это одно из трёх: адрес не
HTTPS, домен туннеля не добавлен в `allowedHosts` (тогда туннель отдаёт 403
Blocked request), либо сервис туннеля показывает свою страницу-заглушку.

## Авторизация через Telegram

### Как это работает

1. Клиент внутри Telegram получает от SDK сырую строку `initData` (сигнал
   `initDataRaw`) и отправляет её в `POST /api/auth/telegram`
   — [client/src/telegram/useAuth.ts](client/src/telegram/useAuth.ts).
2. Сервер проверяет подпись по алгоритму Telegram
   — [server/src/lib/telegram.ts](server/src/lib/telegram.ts):

   ```
   secret_key       = HMAC_SHA256(key = "WebAppData", message = TELEGRAM_BOT_TOKEN)
   data_check_string= поля initData кроме hash и signature, отсортированы, склеены через 

   ожидаемый hash   = HMAC_SHA256(key = secret_key, message = data_check_string)
   ```

   Сравнение — `timingSafeEqual`. Дополнительно отвергаются данные старше
   24 часов (`auth_date`).
3. Если подпись верна — пользователь ищется по `telegramId`; если его нет,
   создаётся новый — [server/src/routes/auth.ts](server/src/routes/auth.ts).

Ответ:

```json
{
  "isNew": true,
  "user": {
    "id": "f1ac2ccd-...",
    "telegramId": "999000001",
    "username": "test_don",
    "firstName": "Тест",
    "referredByCode": "REF123",
    "createdAt": "2026-08-24T11:33:32.867Z"
  }
}
```

Коды ошибок: `400` — нет поля `initData`; `401` — подпись не сошлась или
данные протухли; `503` — на сервере не задан `TELEGRAM_BOT_TOKEN`.

При повторных открытиях обновляются `username` и `firstName`, а
`referredByCode` не перезаписывается — кто пригласил, тот и остаётся.

### Реферальные ссылки

Telegram кладёт в `start_param` то, что указано в ссылке на Mini App:

```
https://t.me/ваш_бот/имя_приложения?startapp=КОД
```

Значение сохраняется в поле `referredByCode` при создании пользователя.
Начисление наград — отдельная задача.

### Как получить и вставить токен бота

1. Откройте [@BotFather](https://t.me/BotFather) → `/mybots` → выберите бота →
   **API Token**. (Для нового бота: `/newbot` → токен приходит сразу.)
   Токен выглядит как `8123456789:AAH...` — это пароль от бота, его нельзя
   публиковать и коммитить.
2. Вставьте его в `server/.env`, в кавычки:

   ```
   TELEGRAM_BOT_TOKEN="8123456789:AAH..."
   ```

3. Перезапустите `npm run dev` — переменные читаются при старте.
   Если токен не задан, при старте сервера в консоли появится предупреждение.

Токен нужен только серверу. На клиент он не передаётся и в бандл не попадает.

### Как проверить, что пользователь появился в базе

1. Запустите `npm run dev`, поднимите туннель и откройте Mini App в Telegram.
2. На карточке должно появиться «Аккаунт создан» (при первом открытии) или
   «Аккаунт подтверждён» (при повторных).
3. Посмотрите строку в базе:

   ```bash
   npm run db:studio
   ```

   http://localhost:5555 → таблица `User`. Там будут ваш `telegramId`,
   `username`, `firstName` и `referredByCode` (если заходили по ссылке с
   `?startapp=КОД`).

Проверить реферальную ссылку: откройте
`https://t.me/ваш_бот/имя_приложения?startapp=TEST123` — у нового пользователя
в `referredByCode` окажется `TEST123`.

> Локально всё это можно погонять без Telegram: `npm run dev:mock` — см.
> раздел «Игровая механика».

## Деплой на Vercel

Клиент и API живут на одном домене: статика собирается из `client/dist`, а весь
`/api/*` обслуживает одна serverless-функция [api/index.ts](api/index.ts),
которая переиспользует то же Express-приложение, что и локальный сервер
([server/src/app.ts](server/src/app.ts)). Правила сборки — в
[vercel.json](vercel.json).

Благодаря общему домену фронтенду не нужен отдельный адрес API и не нужен CORS,
а в BotFather адрес прописывается один раз.

### Первый деплой

**1. Создайте пустой репозиторий на GitHub** (без README и .gitignore) и
подключите его:

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/doncoin.git
```

```bash
git push -u origin main
```

**2. Импортируйте проект в Vercel:** [vercel.com/new](https://vercel.com/new) →
войти через GitHub → **Import** напротив репозитория.

Настройки сборки Vercel возьмёт из `vercel.json`, менять их не нужно
(Framework Preset — `Other`).

**3. Добавьте переменные окружения** в том же экране импорта
(**Environment Variables**) или потом в **Settings → Environment Variables**:

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | строка подключения Neon — возьмите вариант **с пулингом** (в хосте есть `-pooler`) |
| `TELEGRAM_BOT_TOKEN` | токен бота из @BotFather |

Пулинг важен: serverless-функции создают много коротких подключений, и без
пулера база быстро упрётся в лимит соединений.

**4. Нажмите Deploy.** Через пару минут получите адрес вида
`https://doncoin.vercel.app`.

**5. Пропишите этот адрес в BotFather** — `/mybots` → бот →
**Bot Settings → Menu Button → Edit menu button URL**. Больше менять его не
придётся: адрес постоянный.

### Проверка после деплоя

```bash
curl https://ВАШ_ПРОЕКТ.vercel.app/api/health
```

Должно вернуться `{"status":"ok"}`. Затем откройте Mini App в Telegram —
на карточке появится «Аккаунт создан» или «Аккаунт подтверждён».

Логи функции: Vercel → проект → **Logs** (там же видны ошибки Prisma и 401 от
проверки подписи).

### Обновления

Каждый `git push` в `main` автоматически пересобирает прод. Ветки и pull
request'ы получают отдельные превью-адреса — их удобно скармливать BotFather
во втором тестовом боте.

### Миграции базы

Vercel не применяет миграции автоматически. База одна и та же (Neon), поэтому
после изменения схемы применяйте их локально:

```bash
npm run db:migrate
```

Если заведёте отдельную прод-базу — там будет `npm run db:deploy -w server` с
её `DATABASE_URL`.

### Локальная разработка после деплоя

Ничего не меняется: `npm run dev` поднимает Express на `:3000` и Vite на
`:5173` с прокси `/api`. Туннель нужен, только если хотите отлаживать
незадеплоенные правки прямо в Telegram.

## Игровая механика: баланс и тапы

### Экономика

| Параметр | Поле в базе | Стартовое значение |
| --- | --- | --- |
| Баланс | `balance` (BigInt) | 0 |
| Энергия | `energy` / `energyMax` | 1000 / 1000 |
| Восстановление | `energyPerSecond` | 1 в секунду |
| Награда за тап | `coinsPerTap` | 1 |

Все параметры лежат в строке пользователя — апгрейды будут просто менять их.

### Эндпоинты

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/api/game/state` | баланс и энергия с учётом восстановления |
| `POST` | `/api/game/tap` | начислить монеты, тело `{ "taps": 1..50 }` |

Оба требуют заголовок с теми же initData, что и вход:

```
Authorization: tma <raw initData>
```

Подпись проверяется на каждом запросе — сервер не доверяет клиенту даже
telegramId.

### Почему накрутить нельзя

- клиент присылает только **количество тапов**, награду считает сервер по
  `coinsPerTap` из базы;
- больше энергии, чем есть, потратить нельзя — лишние тапы просто не
  засчитываются (`accepted` в ответе меньше запрошенного);
- за один запрос принимается не больше 50 тапов;
- энергия и баланс меняются одним атомарным `UPDATE ... RETURNING`
  ([server/src/lib/game.ts](server/src/lib/game.ts)), поэтому параллельные
  запросы не могут списать одну и ту же энергию дважды;
- время берётся из `now()` базы, а не из часов клиента или сервера.

### Как это ощущается на клиенте

Тап засчитывается локально мгновенно, а на сервер уходит пачкой раз в 700 мс
([client/src/game/useGame.ts](client/src/game/useGame.ts)). Ответ сервера
перезаписывает состояние — он источник правды. Поэтому задержка до базы не
мешает играть, а расхождения самоисправляются.

### Локальная разработка игры без Telegram

```bash
npm run dev:mock
```

Поднимает клиент с фиктивным окружением Telegram и сервер с фиктивным токеном
(`123456:TEST_ONLY_NOT_A_REAL_TOKEN`). Мок подписывает initData тем же
токеном, поэтому проверка подписи проходит и игровой цикл работает целиком —
включая запись в базу.

Токен-заглушка задан в `client/.env.mock` и в скрипте `dev:mock` сервера;
настоящий токен из `server/.env` при этом не используется. В прод-сборку код
мока не попадает.

## Реферальная система

### Как устроено

У каждого игрока есть свой код (`referralCode`, 8 символов без похожих 0/O/1/I)
и ссылка вида:

```
https://t.me/ИМЯ_БОТА/ИМЯ_ПРИЛОЖЕНИЯ?startapp=КОД
```

Telegram кладёт код в `start_param` внутри initData. При **первой** регистрации
сервер находит владельца кода и начисляет обоим:

| Кому | Сколько | Поле |
| --- | --- | --- |
| Пригласившему | 5 000 | `balance` и `referralEarned` |
| Новичку | 1 000 | стартовый `balance` |

Награды выдаются один раз — при создании пользователя, внутри транзакции.
Повторные входы ничего не меняют, связь «кто кого привёл» не переписывается.
Код из ссылки нормализуется (регистр не важен), несуществующий код просто
игнорируется.

Эндпоинт: `GET /api/referrals` — свой код, число приглашённых, заработок и
список друзей ([server/src/routes/referrals.ts](server/src/routes/referrals.ts)).

### Что нужно настроить, чтобы ссылки заработали

Кнопка меню в чате **не передаёт** `startapp`, поэтому нужен прямой адрес
Mini App:

1. В [@BotFather](https://t.me/BotFather): `/newapp` → выбрать бота → название,
   описание, картинка 640×360 → **Web App URL**: `https://doncoin.vercel.app`.
   BotFather выдаст ссылку `https://t.me/ВАШ_БОТ/ИМЯ_ПРИЛОЖЕНИЯ`.
2. В Vercel → проект → **Settings → Environment Variables** добавить:

   | Name | Value |
   | --- | --- |
   | `VITE_MINI_APP_LINK` | `https://t.me/ВАШ_БОТ/ИМЯ_ПРИЛОЖЕНИЯ` |

3. Пересобрать проект (**Deployments → ⋯ → Redeploy**): переменные с префиксом
   `VITE_` попадают в бандл на этапе сборки, поэтому без пересборки ссылка
   останется старой.

Без этой настройки экран «Семья» покажет запасной вариант
`https://t.me/DonCoinTapGameBot?startapp=КОД` — он сработает, только если у
бота настроено главное Mini App.

### Проверка

Откройте свою ссылку с другого аккаунта Telegram: у новичка стартовый баланс
станет 1 000, а у вас на вкладке «Семья» вырастут «Приглашено» и «Заработано»,
и друг появится в списке.
