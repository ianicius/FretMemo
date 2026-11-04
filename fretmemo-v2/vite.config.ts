import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { alphaTab } from '@coderline/alphatab-vite'
import {
  SPA_PRECACHE_GLOB_PATTERNS,
  createSpaNavigationFallbackAllowlist,
} from './scripts/spa-navigation-policy.ts'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '..'),
    emptyOutDir: false,
  },
  plugins: [
    react(),
    // Resolves alphaTab's worker/worklet asset URLs in dev and build —
    // without it the AlphaSynth worker never boots in dev (silent stall).
    alphaTab(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'fretmemo-preview.jpg', 'robots.txt', 'sitemap.xml', 'BingSiteAuth.xml'],
      manifest: {
        name: 'FretMemo - Guitar Fretboard Trainer',
        short_name: 'FretMemo',
        description: 'Free, browser-based guitar fretboard trainer for note memorization, metronome practice, and local progress stats.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#fcfbf8',
        theme_color: '#fcfbf8',
        categories: ['education', 'music', 'productivity'],
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: [...SPA_PRECACHE_GLOB_PATTERNS],
        // alphaTab's worker chunk is emitted but never fetched while the
        // synth runs through AudioWorklets instead; keep it out of the
        // precache. The AudioWorklet chunk itself (alphaTab.worklet-*.js)
        // is precached via the assets glob — playback needs it offline.
        globIgnores: ["assets/alphaTab.worker-*.js"],
        // The soundfont is far too large to precache; cache it on first use
        // so offline playback works after one online session.
        runtimeCaching: [
          {
            urlPattern: /\/soundfont\/.+\.(sf2|sf3)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "soundfonts",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Sound engine assets (NAM models, worklet script, wasm binary):
          // runtime-cached on first use like the soundfont — never precached.
          {
            urlPattern: /\/sound\/.+/i,
            handler: "CacheFirst",
            options: {
              cacheName: "sound-assets",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackAllowlist: createSpaNavigationFallbackAllowlist(),
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
