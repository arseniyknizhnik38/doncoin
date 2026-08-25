import { useCallback, useState } from 'react';
import { ClanScreen } from './clans/ClanScreen';
import { RewardsBar } from './rewards/RewardsBar';
import { useDaily } from './rewards/useDaily';
import { useClans } from './clans/useClans';
import { GameScreen } from './game/GameScreen';
import { LeaderboardScreen } from './leaderboard/LeaderboardScreen';
import { useLeaderboard } from './leaderboard/useLeaderboard';
import { useGame } from './game/useGame';
import { FriendsScreen } from './referrals/FriendsScreen';
import { useReferrals } from './referrals/useReferrals';
import { TasksPanel } from './tasks/TasksPanel';
import { useTasks } from './tasks/useTasks';
import { useAuth } from './telegram/useAuth';
import { ShopScreen } from './upgrades/ShopScreen';
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
  const daily = useDaily(sessionToken, auth.daily, game.applyServerState);
  const board = useLeaderboard(sessionToken, refreshKeys.top);
  const tasks = useTasks(sessionToken, game.applyServerState);
  const [tasksOpen, setTasksOpen] = useState(false);
  const ready = isTelegram && auth.status === 'authorized' && game.state;

  return (
    <main className="relative flex min-h-[var(--tg-viewport-stable-height,100dvh)] flex-col items-center overflow-hidden bg-don-black px-6 text-center">
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
            <ShopScreen
              upgrades={upgrades.upgrades}
              state={game.state}
              loading={upgrades.loading}
              buying={upgrades.buying}
              error={upgrades.error}
              onBuy={upgrades.buy}
            />
          ) : tab === 'clan' ? (
            <ClanScreen clans={clans} />
          ) : tab === 'top' ? (
            <LeaderboardScreen board={board} />
          ) : (
            <FriendsScreen
              data={referrals.data}
              loading={referrals.loading}
              error={referrals.error}
            />
          )}

          <nav className="relative mb-4 flex w-full max-w-md gap-2 rounded-xl border border-don-blood/40 bg-don-ink/80 p-1.5">
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
        </>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center">
          <h1 className="text-6xl font-black tracking-[0.2em] text-don-gold drop-shadow-[0_0_28px_rgba(232,180,72,0.28)] sm:text-8xl">
            DONCOIN
          </h1>
          <p className="mt-6 text-sm font-medium tracking-[0.35em] text-neutral-400 uppercase sm:text-lg">
            START AS NOBODY. BECOME THE DON.
          </p>

          <div className="mt-12 min-w-[16rem] rounded-xl border border-don-blood/60 bg-don-ink/80 px-6 py-4 backdrop-blur-sm">
            {!isTelegram ? (
              <p className="text-sm tracking-wider text-neutral-400">
                Тестовый режим (не в Telegram)
              </p>
            ) : auth.status === 'error' ? (
              <p className="text-sm tracking-wider text-don-blood-light">{auth.error}</p>
            ) : (
              <p className="text-sm tracking-wider text-neutral-400">
                {displayName ? `${displayName}, входим…` : 'Входим…'}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
