import { useCallback, useState } from 'react';
import { AdminPanel } from './admin/AdminPanel';
import { useAds } from './admin/useAds';
import { useCiphers } from './admin/useCiphers';
import { useAdminStats } from './admin/useAdminStats';
import { useBoosters } from './boosters/useBoosters';
import { useBackdrops } from './backdrops/useBackdrops';
import { useBusinesses } from './businesses/useBusinesses';
import { useCipher } from './cipher/useCipher';
import { useOmerta } from './omerta/useOmerta';
import { useFeed } from './feed/useFeed';
import { useEnvelope } from './envelope/useEnvelope';
import { ClanScreen } from './clans/ClanScreen';
import { DealScreen } from './deal/DealScreen';
import { FamilyScreen } from './family/FamilyScreen';
import { useFavors } from './favors/useFavors';
import { useDaily } from './rewards/useDaily';
import { useClans } from './clans/useClans';
import { GameScreen } from './game/GameScreen';
import { RankBackdrop } from './game/RankBackdrop';
import { LeaderboardScreen } from './leaderboard/LeaderboardScreen';
import { useLeaderboard } from './leaderboard/useLeaderboard';
import { useGame } from './game/useGame';
import { useReferrals } from './referrals/useReferrals';
import { Onboarding } from './onboarding/Onboarding';
import { useOnboarding } from './onboarding/useOnboarding';
import { usePerks } from './perks/usePerks';
import { useRetirement } from './retirement/useRetirement';
import { useQuests } from './quests/useQuests';
import { SettingsPanel } from './settings/SettingsPanel';
import { useSettings } from './settings/useSettings';
import { TasksPanel } from './tasks/TasksPanel';
import { LangProvider, useT } from './i18n';
import { ErrorState } from './ui/States';
import { useTasks } from './tasks/useTasks';
import { useAuth } from './telegram/useAuth';
import { useUpgrades } from './upgrades/useUpgrades';
import { useTelegram } from './telegram/useTelegram';

type Tab = 'game' | 'shop' | 'clan' | 'top' | 'friends';

/**
 * Нижняя панель — единственный вход во всё, кроме тапа.
 *
 * «Задания» стоят здесь, а не кнопкой на главном экране: там они были одной
 * из пяти плашек поверх персонажа. Экраном они не становятся — открываются
 * поверх, потому что закрывать их надо возвратом к тапу, а не переходом
 * куда-то ещё.
 */
const TABS: { id: Tab | 'tasks'; label: string }[] = [
  { id: 'game', label: 'Игра' },
  { id: 'tasks', label: 'Задания' },
  { id: 'shop', label: 'Дело' },
  { id: 'clan', label: 'Клан' },
  { id: 'top', label: 'Топ' },
  { id: 'friends', label: 'Семья' },
];

/**
 * Оболочка: язык приходит с сервера, поэтому провайдер стоит снаружи всего
 * остального — иначе часть экрана успела бы отрисоваться на другом языке.
 */
export default function App() {
  const auth = useAuth();

  return (
    <LangProvider lang={auth.language}>
      <Game auth={auth} />
    </LangProvider>
  );
}

function Game({ auth }: { auth: ReturnType<typeof useAuth> }) {
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
  const t = useT();
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
  const backdrops = useBackdrops(sessionToken, refreshKeys.shop, game.applyServerState);
  const daily = useDaily(sessionToken, auth.daily, game.applyServerState);
  const board = useLeaderboard(sessionToken, refreshKeys.top);
  const tasks = useTasks(sessionToken, game.applyServerState);
  const [tasksOpen, setTasksOpen] = useState(false);
  // Задания дня перезапрашиваются при каждом открытии панели: прогресс по
  // ним двигают тапы и покупки, а не сама панель.
  const [questsKey, setQuestsKey] = useState(0);
  const quests = useQuests(sessionToken, questsKey, game.applyServerState);
  // Подписки на каналы живут в заданиях и обновляются вместе с ними.
  const favors = useFavors(sessionToken, questsKey, game.applyServerState);
  const boosters = useBoosters(sessionToken, game.applyServerState);
  const cipher = useCipher(sessionToken, game.applyServerState);
  const omerta = useOmerta(sessionToken, game.applyServerState);
  const envelope = useEnvelope(sessionToken, game.applyServerState);
  // Лента обновляется при открытии клана, но читается и на главном экране —
  // ключ общий, чтобы не тянуть её дважды.
  const feed = useFeed(sessionToken, refreshKeys.clan);
  // Что ждёт игрока в «Заданиях»: награды, неоткрытый конверт, неразгаданный
  // шифр, невыполненные подписки, бонус дня.
  const waiting =
    tasks.readyCount +
    quests.readyCount +
    (daily.status?.available ? 1 : 0) +
    (envelope.envelope?.available ? 1 : 0) +
    (favors.data?.favors.filter((favor) => !favor.completed).length ?? 0) +
    (omerta.omerta && !omerta.omerta.solved && omerta.omerta.attemptsLeft > 0 ? 1 : 0);

  const openTasks = useCallback(() => {
    tasks.reload();
    setQuestsKey((value) => value + 1);
    setTasksOpen(true);
  }, [tasks]);

  const [statsOpen, setStatsOpen] = useState(false);
  const stats = useAdminStats(sessionToken, statsOpen);
  const ads = useAds(sessionToken, statsOpen);
  const ciphers = useCiphers(sessionToken, statsOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettings(sessionToken, settingsOpen);
  const retirement = useRetirement(sessionToken, settingsOpen, game.applyServerState);
  const ready = isTelegram && auth.status === 'authorized' && game.state;
  // Объяснение игры показывается поверх всего, но только когда экран уже
  // загружен: иначе человек читает подсказки про монету, которой не видит.
  const onboarding = useOnboarding(auth.isNew, game.state?.totalEarned ?? null);

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
    <main className="relative z-0 flex h-[var(--tg-viewport-stable-height,100dvh)] flex-col items-center overflow-hidden px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center sm:px-6">
      {/* Обстановка ранга. Пока картинки для ранга нет — остаётся подложка
          ниже, и экран выглядит как раньше, а не сломанным. */}
      {game.state && (
        <RankBackdrop file={game.state.backdrop} visible={tab === 'game'} />
      )}

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
            <GameScreen state={game.state} error={game.error} onTap={game.tap} />
          ) : tab === 'shop' ? (
            <DealScreen
              upgrades={upgrades}
              businesses={businesses}
              perks={perks}
              backdrops={backdrops}
              state={game.state}
            />
          ) : tab === 'clan' ? (
            <ClanScreen clans={clans} feed={feed} />
          ) : tab === 'top' ? (
            <LeaderboardScreen board={board} />
          ) : (
            <FamilyScreen referrals={referrals} />
          )}

          <nav className="relative mb-3 flex w-full max-w-md shrink-0 gap-1 rounded-xl border border-don-blood/40 bg-don-ink/80 p-1.5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.id === 'tasks' ? openTasks() : openTab(item.id as Tab))}
                className={`relative min-h-11 flex-1 rounded-lg px-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors sm:text-sm ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                    : 'text-neutral-500'
                }`}
              >
                {t(item.label)}
                {/* Метка вместо счётчика: число на кнопке в 10 пунктов не
                    читается, а знать надо одно — есть ли там что забрать. */}
                {item.id === 'tasks' && waiting > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-don-gold" />
                )}
              </button>
            ))}
          </nav>
          {onboarding.visible && <Onboarding onDone={onboarding.dismiss} />}

          {tasksOpen && (
            <TasksPanel
              tasks={tasks}
              quests={quests}
              cipher={cipher}
              omerta={omerta}
              envelope={envelope}
              feed={feed}
              favors={favors}
              daily={daily}
              boosters={boosters}
              offline={auth.offline}
              comeback={auth.comeback}
              onClose={() => setTasksOpen(false)}
            />
          )}

          {!settingsOpen && !statsOpen && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Настройки"
              className="absolute top-2 left-4 flex h-11 w-11 items-center justify-center rounded-full border border-don-blood/40 text-base text-neutral-400 active:scale-95"
            >
              ⚙
            </button>
          )}

          {settingsOpen && (
            <SettingsPanel
              api={settings}
              retirement={retirement}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {auth.isAdmin && !statsOpen && (
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              aria-label="Сводка"
              className="absolute top-2 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-don-blood/40 text-base text-neutral-400 active:scale-95"
            >
              ▤
            </button>
          )}

          {statsOpen && (
            <AdminPanel
              api={stats}
              ads={ads}
              ciphers={ciphers}
              token={sessionToken}
              onClose={() => setStatsOpen(false)}
            />
          )}
        </>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center">
          {/* В прежнем кегле название занимало 372px при 343 доступных и
              упиралось в края. На узких экранах сбавляем кегль и разрядку. */}
          <h1 className="font-display text-5xl font-bold tracking-[0.16em] text-don-gold drop-shadow-[0_0_28px_rgba(232,180,72,0.28)] sm:text-8xl sm:tracking-[0.2em]">
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
