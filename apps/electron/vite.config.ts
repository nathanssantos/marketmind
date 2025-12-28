import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron/simple';

const target = process.env.VITE_TARGET || 'electron';
const isWeb = target === 'web';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
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
        '@marketmind/indicators': resolve(__dirname, '../../packages/indicators/src'),
      },
    },
    define: {
      'import.meta.env.VITE_TARGET': JSON.stringify(target),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version || '0.0.0'),
    },
    build: {
      outDir: isWeb ? 'dist-web' : 'dist',
      emptyOutDir: true,
    },
    server: {
      port: isWeb ? 5174 : 5173,
    },
  };
});
