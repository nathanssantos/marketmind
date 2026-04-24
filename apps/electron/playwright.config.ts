import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173);
const BASE_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testDir: './e2e',
      testMatch: /\/e2e\/[^/]+\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-regression',
      testDir: './e2e/visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
    },
    {
      name: 'perf',
      testDir: './e2e/perf',
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        launchOptions: {
          args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
        },
      },
    },
    {
      name: 'electron',
      testDir: './e2e/electron',
      testMatch: '*.spec.ts',
    },
  ],
  webServer: {
    command: `VITE_TARGET=web vite --port ${WEB_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_E2E_BYPASS_AUTH: 'true',
    },
  },
});
