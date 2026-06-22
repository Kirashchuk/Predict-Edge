import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 5173,
    // Proxy API calls to the Hono backend during development.
    proxy: {
      '/v1': { target: process.env.VITE_API_URL || 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    sourcemap: mode === 'production' ? 'hidden' : true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Predict-Edge — On-chain Prediction Markets',
        short_name: 'Predict-Edge',
        description: 'On-chain prediction markets on Arc Testnet — forged in the markets.',
        theme_color: '#0B0E13',
        background_color: '#0B0E13',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', '@tanstack/react-query'],
  },
}));
