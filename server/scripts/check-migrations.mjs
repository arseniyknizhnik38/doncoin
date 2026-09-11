/**
 * Прогоняет все миграции на чистой базе и сверяет результат со схемой Prisma.
 *
 * Зачем: миграции этого проекта писались руками — `prisma migrate dev` требует
 * живого подключения, а его при разработке не было. Ошибка в SQL всплыла бы
 * только на деплое, где `migrate deploy` идёт первым шагом сборки: упавшая
 * миграция роняет весь релиз.
 *
 * База поднимается в самом процессе (PGlite — Postgres, собранный в WASM),
 * поэтому проверка не требует ни сервера, ни докера, ни строки подключения.
 *
 *   npm run check:migrations -w server
 */
import { applyMigrations, migrationFiles, schemaDrift } from './lib/apply-migrations.mjs';

let PGlite;

try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error(
    'Нет @electric-sql/pglite. Поставьте разово:\n' +
      '  npm install --no-save --ignore-scripts @electric-sql/pglite',
  );
  process.exit(1);
}

const db = new PGlite();

console.log(`Миграций к применению: ${migrationFiles().length}\n`);

try {
  await applyMigrations(db, {
    onEach: (name, error) => {
      if (error) {
        console.error(`\n  ПАДАЕТ ${name}\n\n  ${error.message}\n`);
        console.error(
          'Эта миграция уронит сборку на Vercel: migrate deploy идёт первым шагом.',
        );
      } else {
        console.log(`  ok   ${name}`);
      }
    },
  });
} catch {
  process.exit(1);
}

const { tables, problems } = await schemaDrift(db);

console.log(`\nТаблиц создано: ${tables}`);

if (problems.length > 0) {
  console.error('\nСхема и миграции разошлись:\n');
  problems.forEach((problem) => console.error(`  ${problem}`));
  console.error('\nБез недостающих колонок сервер упадёт на первом же запросе.');
  process.exit(1);
}

console.log('Схема и миграции сходятся.');
await db.close();
