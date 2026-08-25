/** Ошибка запроса с кодом от сервера — по нему решаем, что делать дальше. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Запрос к API с сессионным токеном.
 *
 * Токен выдаётся при входе и живёт неделю — initData на каждый запрос больше
 * не пересылаются.
 */
export async function apiFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? `Ошибка ${response.status}`,
      response.status,
      payload?.code ?? null,
    );
  }

  return payload as T;
}

/** true, если сессия истекла и нужно войти заново. */
export const isSessionExpired = (error: unknown) =>
  error instanceof ApiError && error.status === 401;
