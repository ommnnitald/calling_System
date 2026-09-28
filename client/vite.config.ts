import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  // HTTPS is enabled by default to allow camera/mic access on mobile & LAN devices
  const useHttps = mode !== 'http' && process.env.HTTP !== 'true';

  return {
    plugins: [
      react(),
      ...(useHttps ? [basicSsl()] : []),
    ],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/socket.io': {
          target: 'http://127.0.0.1:5000',
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  };
});


