import { useState } from 'react';
import { ClanScreen } from './clans/ClanScreen';
import { useClans } from './clans/useClans';
import { GameScreen } from './game/GameScreen';
import { useGame } from './game/useGame';
import { FriendsScreen } from './referrals/FriendsScreen';
import { useReferrals } from './referrals/useReferrals';
import { useAuth } from './telegram/useAuth';
import { ShopScreen } from './upgrades/ShopScreen';
import { useUpgrades } from './upgrades/useUpgrades';
import { useTelegram } from './telegram/useTelegram';

type Tab = 'game' | 'shop' | 'clan' | 'friends';

const TABS: { id: Tab; label: string }[] = [
  { id: 'game', label: 'Игра' },
  { id: 'shop', label: 'Дело' },
  { id: 'clan', label: 'Клан' },
  { id: 'friends', label: 'Семья' },
];

export default function App() {
  const { isTelegram, displayName } = useTelegram();
  const auth = useAuth();
  const game = useGame(auth.initDataRaw, auth.state);
  // Каталог и рефералку запрашиваем только после успешного входа: до него
  // пользователя в базе ещё нет, и запрос вернул бы «пользователь не найден».
  const authorizedInitData =
    auth.status === 'authorized' ? auth.initDataRaw : undefined;
  const referrals = useReferrals(authorizedInitData);
  const upgrades = useUpgrades(authorizedInitData, game.applyServerState);
  const clans = useClans(authorizedInitData, game.applyServerState);
  const [tab, setTab] = useState<Tab>('game');

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
                onClick={() => setTab(item.id)}
                className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-semibold tracking-wider transition-colors sm:text-sm ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-don-blood to-don-blood-deep text-don-gold-soft'
                    : 'text-neutral-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
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
