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
 *   node ../node_modules/@electric-sql/pglite  # ставится отдельно, см. README
 *   node scripts/check-migrations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'prisma', 'migrations');
const schemaPath = path.join(here, '..', 'prisma', 'schema.prisma');

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

/** Имена миграций в том же порядке, в каком их применит migrate deploy. */
function migrationFiles() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      name,
      sql: path.join(migrationsDir, name, 'migration.sql'),
    }))
    .filter((migration) => fs.existsSync(migration.sql));
}

/**
 * Таблицы и колонки, которых ждёт Prisma.
 *
 * Разбор грубый — регулярками по schema.prisma, без полноценного парсера:
 * нужно поймать расхождение «в схеме поле есть, в миграциях нет», а для
 * этого хватает имён.
 */
function expectedFromSchema() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = new Map();

  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, model, body] = match;
    const fields = new Set();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
        continue;
      }

      const field = trimmed.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);

      if (!field) {
        continue;
      }

      const [, name, type, list] = field;

      // Связи и обратные ссылки колонками не становятся — их в базе нет.
      const isRelation = models.has(type) || /^[A-Z]/.test(type) && !SCALARS.has(type);

      if (isRelation && (list || /@relation/.test(trimmed) || !/@/.test(trimmed))) {
        continue;
      }

      fields.add(name);
    }

    models.set(model, fields);
  }

  return models;
}

const SCALARS = new Set([
  'String', 'Int', 'BigInt', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal',
]);

const db = new PGlite();
const migrations = migrationFiles();

console.log(`Миграций к применению: ${migrations.length}\n`);

for (const migration of migrations) {
  const sql = fs.readFileSync(migration.sql, 'utf8');

  try {
    await db.exec(sql);
    console.log(`  ok   ${migration.name}`);
  } catch (error) {
    console.error(`\n  ПАДАЕТ ${migration.name}\n`);
    console.error(`  ${error.message}\n`);
    console.error('Эта миграция уронит сборку на Vercel: migrate deploy идёт первым шагом.');
    process.exit(1);
  }
}

// Что в итоге получилось в базе.
const columns = await db.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
`);

const actual = new Map();

for (const row of columns.rows) {
  if (!actual.has(row.table_name)) {
    actual.set(row.table_name, new Set());
  }

  actual.get(row.table_name).add(row.column_name);
}

const expected = expectedFromSchema();
const problems = [];

for (const [model, fields] of expected) {
  const table = actual.get(model);

  if (!table) {
    problems.push(`таблицы "${model}" нет в базе, хотя в схеме модель есть`);
    continue;
  }

  for (const field of fields) {
    if (!table.has(field)) {
      problems.push(`"${model}"."${field}" — есть в схеме, нет в миграциях`);
    }
  }
}

console.log(`\nТаблиц создано: ${actual.size}`);

if (problems.length > 0) {
  console.error('\nСхема и миграции разошлись:\n');
  problems.forEach((problem) => console.error(`  ${problem}`));
  console.error('\nБез недостающих колонок сервер упадёт на первом же запросе.');
  process.exit(1);
}

console.log('Схема и миграции сходятся.');
await db.close();
