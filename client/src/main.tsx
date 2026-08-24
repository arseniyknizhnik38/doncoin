import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initTelegram } from './telegram/init';
import { applyTelegramMock } from './telegram/mockEnv';

async function bootstrap() {
  // Эмуляция Telegram — только при VITE_TG_MOCK=1, иначе no-op.
  await applyTelegramMock();

  // SDK инициализируем до рендера: внутри Telegram сразу отдаём expand и цвета,
  // в браузере вызов безопасно возвращает false.
  initTelegram();

  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element #root not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
