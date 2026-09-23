import { ErrorState, SkeletonList } from '../ui/States';
import { AdsPanel } from './AdsPanel';
import { CipherPanel } from './CipherPanel';
import { OmertaPanel } from './OmertaPanel';
import { RafflePanel } from './RafflePanel';
import type { AdsApi } from './useAds';
import type { CiphersApi } from './useCiphers';
import type { AdminStatsApi } from './useAdminStats';

const formatNumber = (value: string | number) => Number(value).toLocaleString('ru-RU');

/** «сегодня», «вчера», «5 дней назад» — по смещению в сутках. */
const dayLabel = (ago: number) => {
  if (ago === 0) {
    return 'сегодня';
  }

  if (ago === 1) {
    return 'вчера';
  }

  return `${ago} дн. назад`;
};

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-don-blood/20 py-1.5 last:border-0">
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="shrink-0 text-sm text-don-gold-soft tabular-nums">
        {value}
        {hint && <span className="ml-1 text-[11px] text-neutral-400">{hint}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-don-edge bg-don-ink/80 px-4 py-3">
      <p className="mb-1 text-[11px] tracking-[0.25em] text-neutral-400 uppercase">{title}</p>
      {children}
    </div>
  );
}

export function AdminPanel({
  api,
  ads,
  ciphers,
  token,
  onClose,
}: {
  api: AdminStatsApi;
  ads: AdsApi;
  ciphers: CiphersApi;
  token: string | null;
  onClose: () => void;
}) {
  const { stats, loading, error } = api;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-don-black/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-6 py-8 [&>*]:shrink-0">
        <header className="flex items-center justify-between">
          <h2 className="font-pixel text-2xl leading-relaxed text-don-gold uppercase">
            Сводка
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-don-edge px-3 min-h-11 inline-flex items-center justify-center py-1.5 text-sm text-neutral-400"
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

            {/* Каждому каналу — своя ссылка с меткой, и уже через сутки
                видно, какой канал привёл игроков, а какой съел бюджет. */}
            <Section title="Источники трафика">
              {stats.sources.length === 0 ? (
                <p className="text-xs leading-relaxed text-neutral-400">
                  Меток пока нет. Дай каналу ссылку вида
                  {' '}
                  <span className="break-all text-don-gold-soft">
                    t.me/DonCoinTapGameBot/?startapp=ad-nazvanie
                  </span>
                  {' '}
                  — и здесь появится строка: сколько пришло, сколько вернулось,
                  сколько подписалось.
                </p>
              ) : (
                stats.sources.map((source) => (
                  <Row
                    key={source.tag}
                    label={source.tag}
                    value={formatNumber(source.total)}
                    hint={`вернулись ${formatNumber(source.returnedNextDay)}${
                      source.eligibleForReturn > 0
                        ? ` из ${formatNumber(source.eligibleForReturn)}`
                        : ''
                    } · подписок ${formatNumber(source.favors)}`}
                  />
                ))
              )}
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
                label="Вступили в семью"
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

            {/* Удержание стоит выше экономики: деньги в игре, из которой
                уходят на второй день, ничего не значат. */}
            <Section title="Удержание">
              {stats.retention.map((point) => (
                <Row
                  key={point.day}
                  label={`День ${point.day}`}
                  value={point.percent === null ? '—' : `${point.percent}%`}
                  hint={
                    point.percent === null
                      ? 'ещё не на ком считать'
                      : `${formatNumber(point.returned)} из ${formatNumber(point.eligible)}`
                  }
                />
              ))}
            </Section>

            <Section title="По дням">
              {stats.days
                .slice()
                .reverse()
                .map((entry) => (
                  <Row
                    key={entry.day}
                    label={dayLabel(entry.ago)}
                    value={formatNumber(entry.activePlayers)}
                    hint={entry.newPlayers > 0 ? `новых ${entry.newPlayers}` : undefined}
                  />
                ))}
            </Section>

            <Section title="Экономика">
              <Row label="DONC на руках" value={formatNumber(stats.economy.inCirculation)} />
              <Row label="Заработано за всё время" value={formatNumber(stats.economy.totalEarned)} />
              <Row label="Богатейший игрок" value={formatNumber(stats.economy.richest)} />
              <Row label="Семей" value={formatNumber(stats.economy.clans)} />
            </Section>

            {/* Реклама — источник дохода, поэтому стоит выше топа игроков. */}
            <AdsPanel api={ads} />

            {/* Шифр задаётся каждый день, поэтому лежит рядом с рекламой:
                обе панели владелец открывает в одном заходе. */}
            <CipherPanel api={ciphers} />
            <OmertaPanel token={token} />

            {/* Розыгрыши стоят после шифров: объявляются реже, чем задаётся
                шифр, но итоги каждого — готовый пост в каналы. */}
            <RafflePanel token={token} />

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
