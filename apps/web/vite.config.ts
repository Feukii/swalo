import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // WS-7 Phase A — PWA app shell (installable + offline shell).
    // Auto-update handles stale-shell-after-deploy (skipWaiting + clientsClaim).
    // No data sync yet: the API is NEVER cached (so /api/sync and auth are never
    // served stale) — runtimeCaching is intentionally empty and /api is excluded
    // from the navigation fallback.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo.svg', 'vite.svg'],
      manifest: {
        name: 'SWALO - Gestion de Boutique',
        short_name: 'SWALO',
        description: 'SWALO — mini-ERP de gestion de boutique',
        theme_color: '#0F2A44',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
