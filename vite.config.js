import { defineConfig } from 'vite';
import { resolve } from 'path';

// Get backend URL from environment variable or use default
const BACKEND_URL = process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      // Proxy .well-known to Express server for domain association file
      '/.well-known': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  // Vite automatically serves files from public directory
  publicDir: 'public',
});

