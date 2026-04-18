import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  poolOptions: {
    threads: {
      singleThread: false,
      maxThreads: 4,
      minThreads: 1,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    exclude: ['**/*.browser.test.{ts,tsx}', '**/node_modules/**', '**/e2e/**'],
    css: true,
    pool: 'threads',
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/dist-electron/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@marketmind/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@marketmind/trading-core': path.resolve(__dirname, '../../packages/trading-core/src/index.ts'),
    },
  },
});
