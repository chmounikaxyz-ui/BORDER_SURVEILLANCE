import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Ignore backend directory, SQLite database files (.db, .db-wal, .db-shm), and evidence files
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/backend/**',
          '**/*.db',
          '**/*.db-wal',
          '**/*.db-shm',
          '**/evidence/**',
        ],
      },
      // Proxy API and evidence static files to FastAPI backend on :8000
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (p) => p,          // keep /api prefix — FastAPI routes are /api/*
          timeout: 120000,            // 2 min timeout for video uploads
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('[Proxy] Error:', err.message);
            });
          },
        },
        '/evidence': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
