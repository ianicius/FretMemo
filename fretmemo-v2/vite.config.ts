import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '..'),
    emptyOutDir: false,
  },
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [
          /^\/v1(?:\/|$)/,
          /^\/v2(?:\/|$)/,
          /^\/blog(?:\/|\.html$)/,
          /^\/faq(?:\.html$|\/$)/,
          /^\/rss\.xml$/,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
          /^\/BingSiteAuth\.xml$/,
        ],
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
