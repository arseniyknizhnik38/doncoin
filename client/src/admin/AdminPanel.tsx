import { ErrorState, SkeletonList } from '../ui/States';
import type { AdminStatsApi } from './useAdminStats';

const formatNumber = (value: string | number) => Number(value).toLocaleString('ru-RU');

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-don-blood/20 py-1.5 last:border-0">
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="shrink-0 text-sm text-don-gold-soft tabular-nums">
        {value}
        {hint && <span className="ml-1 text-[10px] text-neutral-500">{hint}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-don-blood/40 bg-don-ink/70 px-4 py-3">
      <p className="mb-1 text-[10px] tracking-[0.25em] text-neutral-500 uppercase">{title}</p>
      {children}
    </div>
  );
}

export function AdminPanel({ api, onClose }: { api: AdminStatsApi; onClose: () => void }) {
  const { stats, loading, error } = api;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-6 py-8">
        <header className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-[0.2em] text-don-gold uppercase">
            Сводка
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-don-blood/50 px-3 py-1.5 text-sm text-neutral-400"
          >
            Закрыть
          </button>
        </header>

        {!stats ? (
          loading ? (
            <SkeletonList rows={4} />
          ) : (
            <ErrorState message={error ?? 'Не удалось загрузить'} onRetry={api.reload} />
          )
        ) : (
          <>
            <Section title="Игроки">
              <Row label="Всего" value={formatNumber(stats.players.total)} />
              <Row label="Пришли за сутки" value={formatNumber(stats.players.newToday)} />
              <Row label="Пришли за неделю" value={formatNumber(stats.players.newWeek)} />
              <Row label="Заходили за сутки" value={formatNumber(stats.players.dau)} />
              <Row label="Заходили за неделю" value={formatNumber(stats.players.wau)} />
              <Row
                label="Вернулись на следующий день"
                value={`${formatNumber(stats.players.returnedNextDay)} из ${formatNumber(stats.players.eligibleForReturn)}`}
                hint={percent(stats.players.returnedNextDay, stats.players.eligibleForReturn)}
              />
            </Section>

            <Section title="Докуда доходят">
              <Row
                label="Купили улучшение"
                value={formatNumber(stats.funnel.boughtUpgrade)}
                hint={percent(stats.funnel.boughtUpgrade, stats.players.total)}
              />
              <Row
                label="Купили бизнес"
                value={formatNumber(stats.funnel.boughtBusiness)}
                hint={percent(stats.funnel.boughtBusiness, stats.players.total)}
              />
              <Row
                label="Забрали дневной бонус"
                value={formatNumber(stats.funnel.claimedDaily)}
                hint={percent(stats.funnel.claimedDaily, stats.players.total)}
              />
              <Row
                label="Вступили в клан"
                value={formatNumber(stats.funnel.joinedClan)}
                hint={percent(stats.funnel.joinedClan, stats.players.total)}
              />
              <Row
                label="Пришли по реферальной ссылке"
                value={formatNumber(stats.funnel.cameFromReferral)}
                hint={percent(stats.funnel.cameFromReferral, stats.players.total)}
              />
              <Row
                label="Выполнили поручение"
                value={formatNumber(stats.funnel.completedFavor)}
                hint={percent(stats.funnel.completedFavor, stats.players.total)}
              />
            </Section>

            <Section title="Экономика">
              <Row label="DONC на руках" value={formatNumber(stats.economy.inCirculation)} />
              <Row label="Заработано за всё время" value={formatNumber(stats.economy.totalEarned)} />
              <Row label="Богатейший игрок" value={formatNumber(stats.economy.richest)} />
              <Row label="Кланов" value={formatNumber(stats.economy.clans)} />
            </Section>

            <Section title="Топ по заработку">
              {stats.top.map((player, index) => (
                <Row
                  key={`${player.name}-${index}`}
                  label={`${index + 1}. ${player.name}`}
                  value={formatNumber(player.totalEarned)}
                />
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
