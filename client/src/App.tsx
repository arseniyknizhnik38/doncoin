import { GameScreen } from './game/GameScreen';
import { useGame } from './game/useGame';
import { useAuth } from './telegram/useAuth';
import { useTelegram } from './telegram/useTelegram';

export default function App() {
  const { isTelegram, displayName } = useTelegram();
  const auth = useAuth();
  const game = useGame(auth.initDataRaw, auth.state);

  const showGame = isTelegram && auth.status === 'authorized' && game.state;

  return (
    <main className="relative flex min-h-[var(--tg-viewport-stable-height,100dvh)] flex-col items-center justify-center overflow-hidden bg-don-black px-6 text-center">
      {/* Бордовое свечение и золотая линия — «премиальная мафиозная» подложка */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-25%] left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 rounded-full bg-don-blood/30 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-don-gold/50 to-transparent"
      />

      {showGame && game.state ? (
        <GameScreen
          displayName={displayName}
          state={game.state}
          error={game.error}
          onTap={game.tap}
        />
      ) : (
        <div className="relative flex flex-col items-center">
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
