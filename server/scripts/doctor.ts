/**
 * Проверка готовности к запуску: что настроено, а что нет.
 *
 *   npm run doctor -w server
 *
 * Запускается с теми же переменными окружения, что и боевой сервер, —
 * значит может проверять прод:
 *
 *   DATABASE_URL="..." TELEGRAM_BOT_TOKEN="..." npm run doctor -w server
 *
 * Зачем: половина настроек этой игры живёт вне кода — токен бота, права
 * бота в чужих каналах, адрес Mini App, список владельцев, секрет
 * планировщика. Каждая из них ломается молча и по-своему: проверка подписки
 * отвечает «попробуйте позже», сводка владельца отдаёт 404, реферальные
 * ссылки ведут не туда. Разбирать это по симптомам — часы; список из
 * восьми строк отвечает сразу.
 */
import 'dotenv/config';

type Level = 'ok' | 'warn' | 'fail';

interface Check {
  level: Level;
  title: string;
  detail?: string;
  /** Что сделать, если не в порядке. */
  fix?: string;
}

const checks: Check[] = [];

const add = (level: Level, title: string, detail?: string, fix?: string) => {
  checks.push({ level, title, detail, fix });
};

// ——— 1. База
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  add(
    'fail',
    'DATABASE_URL не задан',
    undefined,
    'Скопируйте server/.env.example в server/.env и вставьте строку из Neon.',
  );
} else {
  try {
    const { prisma } = await import('../src/lib/prisma.js');
    const users = await prisma.user.count();
    const businesses = await prisma.business.count();

    add('ok', 'База отвечает', `игроков ${users}, бизнесов в каталоге ${businesses}`);

    if (businesses === 0) {
      add(
        'fail',
        'Каталог бизнесов пуст',
        'игроку нечего покупать',
        'Запустите npm run db:seed. На проде это делает сборка.',
      );
    }

    // Миграции: сравниваем применённые с файлами в репозитории.
    const { migrationFiles } = await import('./lib/apply-migrations.mjs');
    const files = migrationFiles().map((migration) => migration.name);

    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `.catch(() => null);

    if (applied === null) {
      add(
        'warn',
        'Таблицы миграций нет',
        'схему накатывали не через migrate deploy',
        'Убедитесь, что сборка на Vercel выполняет npm run db:deploy.',
      );
    } else {
      const names = new Set(applied.map((row) => row.migration_name));
      const missing = files.filter((name) => !names.has(name));

      if (missing.length === 0) {
        add('ok', 'Миграции применены', `всего ${files.length}`);
      } else {
        add(
          'fail',
          `Не применено миграций: ${missing.length}`,
          missing.join(', '),
          'Прод работает на старой схеме. Проверьте, что сборка на Vercel зелёная.',
        );
      }
    }
  } catch (error) {
    add(
      'fail',
      'База недоступна',
      error instanceof Error ? error.message.split('\n')[0] : String(error),
      'Проверьте DATABASE_URL и что база Neon не усыплена.',
    );
  }
}

// ——— 2. Бот
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  add(
    'fail',
    'TELEGRAM_BOT_TOKEN не задан',
    'вход в игру отвечает 503',
    'Возьмите токен у @BotFather и положите в переменные окружения.',
  );
} else {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const payload = (await response.json()) as {
      ok: boolean;
      result?: { username?: string; id?: number };
      description?: string;
    };

    if (payload.ok) {
      add('ok', 'Бот отвечает', `@${payload.result?.username ?? 'без имени'}`);
    } else {
      add(
        'fail',
        'Токен бота отвергнут Telegram',
        payload.description,
        'Проверьте, что токен скопирован целиком и не отозван.',
      );
    }

    // ——— 3. Права бота в каналах рекламных кампаний.
    //
    // Самая частая поломка: кампания заведена, игрок подписался, а проверка
    // отвечает «попробуйте позже», потому что бот не админ канала и не
    // может спросить у Telegram состав участников.
    if (payload.ok && databaseUrl) {
      const { prisma } = await import('../src/lib/prisma.js');
      const { isRunning } = await import('../src/config/ads.js');
      const now = new Date();
      const running = (await prisma.favor.findMany({ where: { active: true } }))
        .filter((favor) => isRunning(favor, now));

      if (running.length === 0) {
        add('warn', 'Идущих рекламных кампаний нет', 'вкладка «Семья» будет пустой');
      }

      for (const favor of running) {
        const check = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember` +
            `?chat_id=${encodeURIComponent(favor.channelChatId)}` +
            `&user_id=${payload.result?.id}`,
        );
        const result = (await check.json()) as {
          ok: boolean;
          result?: { status?: string };
          description?: string;
        };

        if (!result.ok) {
          add(
            'fail',
            `Бот не видит канал ${favor.channelName}`,
            result.description,
            `Добавьте @${payload.result?.username} администратором в ${favor.channelUrl}.`,
          );
        } else if (result.result?.status !== 'administrator') {
          add(
            'fail',
            `Бот не администратор в ${favor.channelName}`,
            `статус «${result.result?.status}»`,
            'Без прав администратора проверка подписки всегда отвечает «попробуйте позже».',
          );
        } else {
          add('ok', `Подписку на ${favor.channelName} можно проверить`);
        }
      }
    }
  } catch (error) {
    add(
      'fail',
      'Не достучались до Telegram',
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ——— 4. Доступ владельца
const admins = (process.env.ADMIN_TELEGRAM_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (admins.length === 0) {
  add(
    'warn',
    'ADMIN_TELEGRAM_IDS пуст',
    'сводку и управление рекламой не откроет никто',
    'Впишите свой Telegram ID — узнать его можно у @userinfobot.',
  );
} else {
  add('ok', 'Владельцев указано', String(admins.length));
}

// ——— 5. Планировщик
if (!process.env.CRON_SECRET) {
  add(
    'warn',
    'CRON_SECRET не задан',
    'напоминания и подведение итогов войн не работают',
    'Одна случайная строка в Vercel и в секретах GitHub — значения должны совпадать.',
  );
} else {
  add('ok', 'Секрет планировщика на месте');
}

// ——— 6. Ссылка на Mini App: собирается в бандл клиента, здесь только напоминание.
add(
  'warn',
  'VITE_MINI_APP_LINK проверьте вручную',
  'переменная попадает в бандл на сборке, с сервера её не видно',
  'Vercel → Settings → Environment Variables, затем пересобрать: без пересборки ссылка останется старой.',
);

// ——— Вывод
const icon = { ok: ' ok ', warn: ' !  ', fail: 'ФЕЙЛ' } as const;

console.log('\nГотовность к запуску\n');

for (const check of checks) {
  console.log(`  ${icon[check.level]} ${check.title}${check.detail ? ` — ${check.detail}` : ''}`);

  if (check.fix && check.level !== 'ok') {
    console.log(`        ${check.fix}`);
  }
}

const failed = checks.filter((check) => check.level === 'fail').length;
const warned = checks.filter((check) => check.level === 'warn').length;

console.log(
  `\nПроблем: ${failed}, предупреждений: ${warned}, в порядке: ` +
    `${checks.length - failed - warned}\n`,
);

// Соединение закрываем явно, и выходим кодом возврата, а не process.exit():
// принудительный выход обрывает сокет, не дав ему закрыться по-человечески.
if (databaseUrl) {
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();
}

process.exitCode = failed > 0 ? 1 : 0;
