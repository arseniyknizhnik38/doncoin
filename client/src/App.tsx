import { useCallback, useState } from 'react';
import { AdminPanel } from './admin/AdminPanel';
import { useAdminStats } from './admin/useAdminStats';
import { useBusinesses } from './businesses/useBusinesses';
import { ClanScreen } from './clans/ClanScreen';
import { DealScreen } from './deal/DealScreen';
import { FamilyScreen } from './family/FamilyScreen';
import { useFavors } from './favors/useFavors';
import { RewardsBar } from './rewards/RewardsBar';
import { useDaily } from './rewards/useDaily';
import { useClans } from './clans/useClans';
import { GameScreen } from './game/GameScreen';
import { LeaderboardScreen } from './leaderboard/LeaderboardScreen';
import { useLeaderboard } from './leaderboard/useLeaderboard';
import { useGame } from './game/useGame';
import { useReferrals } from './referrals/useReferrals';
import { usePerks } from './perks/usePerks';
import { SettingsPanel } from './settings/SettingsPanel';
import { useSettings } from './settings/useSettings';
import { TasksPanel } from './tasks/TasksPanel';
import { ErrorState } from './ui/States';
import { useTasks } from './tasks/useTasks';
import { useAuth } from './telegram/useAuth';
import { useUpgrades } from './upgrades/useUpgrades';
import { useTelegram } from './telegram/useTelegram';

type Tab = 'game' | 'shop' | 'clan' | 'top' | 'friends';

const TABS: { id: Tab; label: string }[] = [
  { id: 'game', label: 'Игра' },
  { id: 'shop', label: 'Дело' },
  { id: 'clan', label: 'Клан' },
  { id: 'top', label: 'Топ' },
  { id: 'friends', label: 'Семья' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('game');

  // Данные вкладок обновляются при их открытии: каталог, кланы и топ иначе
  // остаются такими, какими были на момент входа.
  const [refreshKeys, setRefreshKeys] = useState<Record<Tab, number>>({
    game: 0,
    shop: 0,
    clan: 0,
    top: 0,
    friends: 0,
  });

  const openTab = useCallback((id: Tab) => {
    setTab(id);
    setRefreshKeys((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  }, []);

  const { isTelegram, displayName } = useTelegram();
  const auth = useAuth();
  const game = useGame(
    auth.status === 'authorized' ? auth.sessionToken : null,
    auth.state,
    auth.reauth,
  );
  // Запрашиваем данные только после успешного входа: до него пользователя
  // в базе ещё нет, да и сессионного токена тоже.
  const sessionToken = auth.status === 'authorized' ? auth.sessionToken : null;
  const referrals = useReferrals(sessionToken);
  const upgrades = useUpgrades(sessionToken, refreshKeys.shop, game.applyServerState);
  const clans = useClans(sessionToken, refreshKeys.clan, game.applyServerState);
  const businesses = useBusinesses(sessionToken, refreshKeys.shop, game.applyServerState);
  const perks = usePerks(sessionToken, refreshKeys.shop, game.applyServerState);
  const favors = useFavors(sessionToken, refreshKeys.friends, game.applyServerState);
  const daily = useDaily(sessionToken, auth.daily, game.applyServerState);
  const board = useLeaderboard(sessionToken, refreshKeys.top);
  const tasks = useTasks(sessionToken, game.applyServerState);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const stats = useAdminStats(sessionToken, statsOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettings(sessionToken, settingsOpen);
  const ready = isTelegram && auth.status === 'authorized' && game.state;

  // Технические сообщения вроде «Ошибка 500» игроку бесполезны — подменяем
  // их человеческим текстом, остальные показываем как есть.
  const rawAuthError = auth.error ?? '';
  const looksLikeNetwork = ['500', '502', '503', '504', 'failed', 'fetch', 'сет'].some(
    (hint) => rawAuthError.toLowerCase().includes(hint),
  );
  const authErrorText = looksLikeNetwork
    ? 'Не получилось связаться с сервером'
    : rawAuthError || 'Не удалось войти';

  return (
    <main className="relative flex h-[var(--tg-viewport-stable-height,100dvh)] flex-col items-center overflow-hidden bg-don-black px-4 text-center sm:px-6">
      {/* Бордовое свечение и золотая линия — «премиальная мафиозная» подложка */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-25%] left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 rounded-full bg-don-blood/30 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-don-gold/50 to-transparent"
      />

      {ready && game.state ? (
        <>
          {tab === 'game' ? (
            <GameScreen
              displayName={displayName}
              state={game.state}
              error={game.error}
              onTap={game.tap}
              rewards={
                <RewardsBar
                  offline={auth.offline}
                  daily={daily}
                  tasksReady={tasks.readyCount}
                  onOpenTasks={() => {
                    tasks.reload();
                    setTasksOpen(true);
                  }}
                />
              }
            />
          ) : tab === 'shop' ? (
            <DealScreen
              upgrades={upgrades}
              businesses={businesses}
              perks={perks}
              state={game.state}
            />
          ) : tab === 'clan' ? (
            <ClanScreen clans={clans} />
          ) : tab === 'top' ? (
            <LeaderboardScreen board={board} />
          ) : (
            <FamilyScreen referrals={referrals} favors={favors} />
          )}

          <nav className="relative mb-3 flex w-full max-w-md shrink-0 gap-1 rounded-xl border border-don-blood/40 bg-don-ink/80 p-1.5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openTab(item.id)}
                className={`flex-1 rounded-lg px-1.5 py-2.5 text-[11px] font-semibold tracking-wide transition-colors sm:text-sm ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                    : 'text-neutral-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {tasksOpen && (
            <TasksPanel tasks={tasks} onClose={() => setTasksOpen(false)} />
          )}

          {!settingsOpen && !statsOpen && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки"
              className="absolute top-2 left-4 rounded-lg border border-don-blood/40 px-2 py-1 text-[10px] tracking-wider text-neutral-500"
            >
              ⚙
            </button>
          )}

          {settingsOpen && (
            <SettingsPanel api={settings} onClose={() => setSettingsOpen(false)} />
          )}

          {auth.isAdmin && !statsOpen && (
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="absolute top-2 right-4 rounded-lg border border-don-blood/40 px-2 py-1 text-[10px] tracking-wider text-neutral-500"
            >
              Сводка
            </button>
          )}

          {statsOpen && <AdminPanel api={stats} onClose={() => setStatsOpen(false)} />}
        </>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center">
          <h1 className="text-6xl font-black tracking-[0.2em] text-don-gold drop-shadow-[0_0_28px_rgba(232,180,72,0.28)] sm:text-8xl">
            DONCOIN
          </h1>
          <p className="mt-6 text-sm font-medium tracking-[0.35em] text-neutral-400 uppercase sm:text-lg">
            START AS NOBODY. BECOME THE DON.
          </p>

          {isTelegram && auth.status === 'error' ? (
            <div className="mt-12 w-full max-w-xs">
              <ErrorState
                message={authErrorText}
                onRetry={auth.reauth}
              />
            </div>
          ) : (
            <div className="mt-12 min-w-[16rem] rounded-xl border border-don-blood/60 bg-don-ink/80 px-6 py-4 backdrop-blur-sm">
              {!isTelegram ? (
                <p className="text-sm tracking-wider text-neutral-400">
                  Тестовый режим (не в Telegram)
                </p>
              ) : (
                <p className="text-sm tracking-wider text-neutral-400">
                  {displayName ? `${displayName}, входим…` : 'Входим…'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
