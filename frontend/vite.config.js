import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false, // manifest statique versionné dans public/
      workbox: {
        // SPA : toute navigation non-fichier → index.html (routes React intactes).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Cache STRICTEMENT statique : jamais de /api (données privées, JWT).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'image' || request.destination === 'font'),
            handler: 'CacheFirst',
            options: { cacheName: 'mada-static-media', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Sépare Recharts (lourd) du bundle principal : résorbe le warning E7.
        manualChunks: {
          recharts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5174, // 5173 occupé par un autre projet sur cette machine — ne pas toucher
    strictPort: true,
  },
  preview: { port: 5174 },
});
