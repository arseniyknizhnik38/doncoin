import { useState } from 'react';
import type { AdDraft, AdsApi } from './useAds';

const formatNumber = (value: string | number) => Number(value).toLocaleString('ru-RU');

const EMPTY: AdDraft = {
  advertiser: '',
  title: 'Проверь, что пришло с той стороны границы',
  channelName: '',
  channelUrl: '',
  channelChatId: '',
  rewardDonc: 50_000,
  rewardHours: 3,
  slots: null,
  endsAt: null,
};

const STATUS_COLORS: Record<string, string> = {
  running: 'text-emerald-400/80',
  scheduled: 'text-neutral-400',
  finished: 'text-neutral-400',
  sold_out: 'text-don-gold-soft',
  stopped: 'text-neutral-400',
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
    </label>
  );
}

const inputClass =
  'rounded-lg border border-don-blood/50 bg-black/40 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400';

/**
 * Управление рекламными кампаниями.
 *
 * Игра зарабатывает на них, поэтому завести клиента нужно уметь с телефона
 * и без деплоя: раньше каталог лежал в коде, и каждый новый рекламодатель
 * стоил коммита.
 */
export function AdsPanel({ api }: { api: AdsApi }) {
  const [draft, setDraft] = useState<AdDraft>(EMPTY);
  const [open, setOpen] = useState(false);

  const set = <K extends keyof AdDraft>(key: K, value: AdDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] tracking-[0.25em] text-don-gold-soft uppercase">
          Реклама
        </h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center px-2 text-xs text-don-gold-soft"
        >
          {open ? 'Свернуть' : '+ Кампания'}
        </button>
      </div>

      {open && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-don-blood/40 bg-don-ink/70 p-3"
          onSubmit={async (event) => {
            event.preventDefault();

            if (await api.create(draft)) {
              setDraft(EMPTY);
              setOpen(false);
            }
          }}
        >
          <Field label="Рекламодатель" hint="Для отчётности, игроку не видно">
            <input
              className={inputClass}
              value={draft.advertiser}
              onChange={(event) => set('advertiser', event.target.value)}
              placeholder="ООО Ромашка"
            />
          </Field>

          <Field label="Название канала">
            <input
              className={inputClass}
              value={draft.channelName}
              onChange={(event) => set('channelName', event.target.value)}
              placeholder="Матрёшка Экспресс"
              required
            />
          </Field>

          <Field label="Ссылка">
            <input
              className={inputClass}
              value={draft.channelUrl}
              onChange={(event) => set('channelUrl', event.target.value)}
              placeholder="https://t.me/channel"
              required
            />
          </Field>

          <Field
            label="ID для проверки"
            hint="@username канала. Бот должен быть админом канала, иначе подписку не проверить"
          >
            <input
              className={inputClass}
              value={draft.channelChatId}
              onChange={(event) => set('channelChatId', event.target.value)}
              placeholder="@channel"
              required
            />
          </Field>

          <Field label="Текст задания">
            <input
              className={inputClass}
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Награда, DONC" hint="Нижняя граница">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={draft.rewardDonc}
                onChange={(event) => set('rewardDonc', Number(event.target.value))}
              />
            </Field>

            <Field label="Или часов дохода" hint="Растёт вместе с игроком">
              <input
                className={inputClass}
                type="number"
                min={0}
                step={0.5}
                value={draft.rewardHours ?? ''}
                onChange={(event) =>
                  set(
                    'rewardHours',
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Лимит подписок" hint="Пусто — без лимита">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={draft.slots ?? ''}
                onChange={(event) =>
                  set('slots', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </Field>

            <Field label="Идёт до" hint="Пусто — без срока">
              <input
                className={inputClass}
                type="date"
                value={draft.endsAt ?? ''}
                onChange={(event) =>
                  set('endsAt', event.target.value === '' ? null : event.target.value)
                }
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={api.saving}
            className="mt-1 rounded-lg bg-don-blood border-b-2 border-b-don-blood-deep px-4 min-h-11 inline-flex items-center justify-center py-2.5 text-sm font-semibold text-don-gold-soft disabled:opacity-50"
          >
            {api.saving ? 'Сохраняем…' : 'Запустить'}
          </button>
        </form>
      )}

      {api.error && (
        <p className="text-xs tracking-wider text-don-blood-light">{api.error}</p>
      )}

      {(api.ads ?? []).map((ad) => (
        <div
          key={ad.id}
          className="rounded-lg border border-don-blood/40 bg-don-ink/70 px-4 py-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-neutral-100">
              {ad.channelName}
            </span>
            <span
              className={`shrink-0 text-[10px] tracking-[0.2em] uppercase ${
                STATUS_COLORS[ad.status] ?? 'text-neutral-500'
              }`}
            >
              {ad.statusTitle}
            </span>
          </div>

          {ad.advertiser && (
            <p className="mt-0.5 text-[11px] text-neutral-400">{ad.advertiser}</p>
          )}

          <p className="mt-1 text-xs text-neutral-400">
            Подписок:{' '}
            <span className="text-don-gold-soft tabular-nums">
              {formatNumber(ad.completedCount)}
              {ad.slots !== null && ` из ${formatNumber(ad.slots)}`}
            </span>
            {ad.rewardHours !== null ? (
              <span className="text-neutral-400"> · {ad.rewardHours} ч дохода</span>
            ) : (
              <span className="text-neutral-400"> · {formatNumber(ad.rewardDonc)} DONC</span>
            )}
          </p>

          {ad.endsAt && (
            <p className="mt-0.5 text-[11px] text-neutral-400">
              До {new Date(ad.endsAt).toLocaleDateString('ru-RU')}
            </p>
          )}

          <p className="mt-0.5 text-[11px] text-neutral-400">
            Подписку проверяем по: {ad.channelChatId}
          </p>

          {api.diagnoses[ad.id] && (
            <p
              className={`mt-2 text-xs ${
                api.diagnoses[ad.id] === 'checking'
                  ? 'text-neutral-500'
                  : (api.diagnoses[ad.id] as { ok: boolean }).ok
                    ? 'text-emerald-400'
                    : 'text-don-blood-light'
              }`}
            >
              {api.diagnoses[ad.id] === 'checking'
                ? 'Проверяем…'
                : (api.diagnoses[ad.id] as { message: string }).message}
            </p>
          )}

          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => api.diagnose(ad.id)}
              className="text-[11px] tracking-wider text-don-gold-soft"
            >
              Проверить бота
            </button>
            {ad.status !== 'stopped' && (
              <button
                type="button"
                onClick={() => api.stop(ad.id)}
                className="text-[11px] tracking-wider text-don-blood-light"
              >
                Снять с показа
              </button>
            )}
          </div>
        </div>
      ))}

      {api.ads?.length === 0 && !api.loading && (
        <p className="text-xs text-neutral-400">
          Кампаний нет. Первая же принесёт подписчиков рекламодателю и монеты игрокам.
        </p>
      )}
    </div>
  );
}
