import { ErrorState } from '../ui/States';
import type { SettingsApi } from './useSettings';

export function SettingsPanel({ api, onClose }: { api: SettingsApi; onClose: () => void }) {
  const { settings, loading, saving, error } = api;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-6 py-8">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-[0.2em] text-don-gold uppercase">
            Настройки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-don-blood/50 px-3 py-1.5 text-sm text-neutral-400"
          >
            Закрыть
          </button>
        </header>

        {!settings ? (
          loading ? (
            <p className="text-center text-sm tracking-wider text-neutral-500">Загружаем…</p>
          ) : (
            <ErrorState message={error ?? 'Не удалось загрузить'} />
          )
        ) : (
          <div className="rounded-xl border border-don-blood/50 bg-don-ink/80 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-100">Напоминания от бота</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Сообщение, когда энергия восстановилась, бизнесы накопили доход или
                  серия вот-вот прервётся. Не чаще раза в сутки и не по ночам.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                disabled={saving}
                onClick={() => api.setNotifications(!settings.notificationsEnabled)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  settings.notificationsEnabled ? 'bg-don-gold/80' : 'bg-neutral-700'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-don-black transition-all ${
                    settings.notificationsEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {settings.notificationsBlocked && (
              <p className="mt-3 text-xs text-don-blood-light">
                Бот не может вам написать — похоже, он заблокирован. Разблокируйте его
                в Telegram, и напоминания вернутся.
              </p>
            )}

            {error && (
              <p className="mt-3 text-xs text-don-blood-light">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
