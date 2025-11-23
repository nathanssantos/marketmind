import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['**/*.browser.test.{ts,tsx}'],
    setupFiles: './src/tests/setup.browser.ts',
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
      screenshotFailures: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
    },
  },
  optimizeDeps: {
    include: [
      '@testing-library/jest-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      '@chakra-ui/react',
      'react-i18next',
      '@emotion/react/jsx-dev-runtime',
      'react-icons/lu',
      'nanoid',
      'zustand',
      'date-fns',
    ],
  },
});
