/**
 * Доступ к сводке. Список задаётся переменной ADMIN_TELEGRAM_IDS через
 * запятую — так права не зашиты в код и правятся без деплоя.
 *
 * Пустой список означает «никто»: лучше остаться без доступа, чем случайно
 * открыть чужую статистику.
 */
export function adminIds(): Set<string> {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? '';

  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isAdmin(telegramId: string): boolean {
  return adminIds().has(telegramId);
}
