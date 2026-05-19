import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const base = process.env.BASE_PATH ?? '';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      base: `${base}/`,
      scope: `${base}/`,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ico}']
      },
      manifest: {
        name: 'Krusty Score',
        short_name: 'Krusty',
        description: 'Offline scoring for in-person Krusty Gin.',
        start_url: `${base}/`,
        scope: `${base}/`,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ]
});
