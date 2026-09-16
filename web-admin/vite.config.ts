import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Built output is served by FullScanServer at /admin-app (see src/routes/admin-app.routes.ts),
 * so `base` must stay '/admin-app/'. In development the Vite server proxies the API to the
 * Express server, which keeps every request same-origin — the session cookie is
 * `SameSite=Strict` and the production CSP only allows `connect-src 'self'`.
 */
const API_ORIGIN = process.env.FULLSCAN_API_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  base: '/admin-app/',
  plugins: [react(), tailwindcss()],
  publicDir: false,
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: false },
    },
  },
  preview: {
    port: 4174,
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Maps are generated for debugging but not referenced from the served bundle.
    sourcemap: 'hidden',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
