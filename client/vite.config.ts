import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Домены туннелей для запуска Mini App внутри Telegram (см. README).
    // Без этого Vite отвечает 403 Blocked request на чужой Host-заголовок.
    allowedHosts: [
      '.lhr.life', // localhost.run
      '.serveo.net',
      '.pinggy.link',
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok.io',
      '.loca.lt',
    ],
    proxy: {
      // Forward API calls to the Express server during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
