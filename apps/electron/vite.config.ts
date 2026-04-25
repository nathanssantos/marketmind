import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { VitePWA } from 'vite-plugin-pwa';

const target = process.env.VITE_TARGET || 'electron';
const isWeb = target === 'web';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      isWeb && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],
        manifest: {
          name: 'MarketMind',
          short_name: 'MarketMind',
          description: 'Trading analysis platform',
          theme_color: '#1e222d',
          background_color: '#1e222d',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.binance\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'binance-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 5,
                },
              },
            },
          ],
        },
      }),
      !isWeb && electron({
        main: {
          entry: 'src/main/index.ts',
          vite: {
            build: {
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: [
                  'electron',
                  'electron-updater',
                  'electron-log',
                  'electron-store',
                ],
              },
            },
          },
        },
        preload: {
          input: 'src/main/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron/preload',
            },
          },
        },
        renderer: {},
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@shared': resolve(__dirname, './src/shared'),
        '@renderer': resolve(__dirname, './src/renderer'),
        '@main': resolve(__dirname, './src/main'),
        '@marketmind/types': resolve(__dirname, '../../packages/types/src'),
        '@marketmind/fibonacci': resolve(__dirname, '../../packages/fibonacci/src'),
        '@marketmind/utils': resolve(__dirname, '../../packages/utils/src'),
        '@marketmind/trading-core': resolve(__dirname, '../../packages/trading-core/src'),
      },
    },
    define: {
      'import.meta.env.VITE_TARGET': JSON.stringify(target),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version || '0.0.0'),
    },
    build: {
      outDir: isWeb ? 'dist-web' : 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (/[\\/]node_modules[\\/](react|react-dom)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('/node_modules/@chakra-ui/')) return 'vendor-chakra';
            if (id.includes('/node_modules/@tanstack/react-query/')) return 'vendor-query';
            if (/[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/.test(id)) return 'vendor-i18n';
            if (/[\\/]node_modules[\\/](zustand|immer)[\\/]/.test(id)) return 'vendor-zustand';
            return undefined;
          },
        },
      },
    },
    server: {
      port: isWeb ? 5174 : 5173,
    },
  };
});
