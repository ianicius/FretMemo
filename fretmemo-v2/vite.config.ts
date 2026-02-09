import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/fretmemo-v2/dist/',
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
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
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
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
