import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

const target = process.env.VITE_TARGET || 'electron';
const isWeb = target === 'web';
const analyze = process.env.ANALYZE === '1';

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
      !isWeb && electron([
        {
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
        {
          onstart: ({ reload }) => reload(),
          vite: {
            build: {
              outDir: 'dist-electron/preload',
              rollupOptions: {
                input: 'src/main/preload.ts',
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].mjs',
                  chunkFileNames: '[name].mjs',
                  assetFileNames: '[name].[ext]',
                },
              },
            },
          },
        },
      ]),
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
            // V1_3 D.1 — split heavy single-purpose deps into their own chunks so
            // they can be cached independently and lazy-loaded callsites benefit
            // from a smaller main bundle.
            if (id.includes('/node_modules/pinets/')) return 'vendor-pinets';
            if (id.includes('/node_modules/recharts/')) return 'vendor-recharts';
            if (id.includes('/node_modules/d3-')) return 'vendor-d3';
            if (/[\\/]node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/.test(id)) return 'vendor-socket';
            if (id.includes('/node_modules/react-icons/')) return 'vendor-icons';
            if (/[\\/]node_modules[\\/](react-grid-layout|react-draggable|react-resizable)[\\/]/.test(id)) return 'vendor-grid';
            if (id.includes('/node_modules/@trpc/')) return 'vendor-trpc';
            return undefined;
          },
        },
        plugins: analyze
          ? [visualizer({ filename: 'dist-web/bundle-stats.html', template: 'treemap', gzipSize: true, brotliSize: true, open: false })]
          : [],
      },
    },
    server: {
      port: isWeb ? 5174 : 5173,
    },
  };
});
