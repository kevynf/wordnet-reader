import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Wordnet Reader',
        short_name: 'Wordnet Reader',
        description: 'A readability-focused, offline-friendly browser for Open English Wordnet.',
        theme_color: '#121417',
        background_color: '#121417',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        globIgnores: ['data/2025-plus/**'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\/(?:manifest|index)\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wordnet-data-runtime',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/data\/.*\/(?:entries|synsets)\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wordnet-data-runtime',
              expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
