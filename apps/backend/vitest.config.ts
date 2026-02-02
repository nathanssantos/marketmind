import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/__tests__/setup.ts',
    globalSetup: './src/__tests__/globalSetup.ts',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: {
      shuffle: false,
    },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        'src/db/migrations/',
        'test-*.mjs',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@marketmind/types': path.resolve(__dirname, '../../packages/types/src'),
      '@marketmind/indicators': path.resolve(__dirname, '../../packages/indicators/src'),
      '@marketmind/risk': path.resolve(__dirname, '../../packages/risk/src'),
    },
  },
});
