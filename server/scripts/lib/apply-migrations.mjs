import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', '..', 'prisma', 'migrations');

/** Имена миграций в том же порядке, в каком их применит migrate deploy. */
export function migrationFiles() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, sql: path.join(migrationsDir, name, 'migration.sql') }))
    .filter((migration) => fs.existsSync(migration.sql));
}

/**
 * Накатывает миграции по порядку на переданную базу.
 *
 * SQL выполняется напрямую, а не через `prisma migrate deploy`. Причина
 * прозаическая: движок миграций — отдельный бинарник, и с сокетом PGlite он
 * не договаривается («Can't reach database server»), хотя обычный клиент
 * Prisma через тот же сокет работает без нареканий.
 *
 * На проде миграции по-прежнему применяет `migrate deploy` — он идёт первым
 * шагом сборки. Здесь же проверяется ровно то, ради чего стенд и заведён:
 * что этот SQL ложится на пустую базу и даёт схему, которую ждёт код.
 */
export async function applyMigrations(db, { onEach } = {}) {
  const migrations = migrationFiles();

  for (const migration of migrations) {
    const sql = fs.readFileSync(migration.sql, 'utf8');

    try {
      await db.exec(sql);
      onEach?.(migration.name, null);
    } catch (error) {
      onEach?.(migration.name, error);
      throw new Error(`миграция ${migration.name}: ${error.message}`);
    }
  }

  return migrations.length;
}

/**
 * Таблицы и колонки, которых ждёт Prisma.
 *
 * Разбор грубый — регулярками по schema.prisma, без полноценного парсера:
 * нужно поймать расхождение «в схеме поле есть, в миграциях нет», а для
 * этого хватает имён.
 */
export function expectedFromSchema() {
  const schemaPath = path.join(here, '..', '..', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = new Map();

  const SCALARS = new Set([
    'String', 'Int', 'BigInt', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal',
  ]);

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
      const isRelation = !SCALARS.has(type) && /^[A-Z]/.test(type);

      if (isRelation && (list || /@relation/.test(trimmed) || !/@/.test(trimmed))) {
        continue;
      }

      fields.add(name);
    }

    models.set(model, fields);
  }

  return models;
}

/** Расхождения между схемой и тем, что реально создали миграции. */
export async function schemaDrift(db) {
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

  const problems = [];

  for (const [model, fields] of expectedFromSchema()) {
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

  return { tables: actual.size, problems };
}
