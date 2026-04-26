import { test, expect } from '@playwright/test';
import { launchApp, closeApp, type LaunchedApp } from './app-launch';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMockOnContext } from '../helpers/trpcMock';

let launched: LaunchedApp;

test.describe('Electron smoke', () => {
  test.beforeAll(async () => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    launched = await launchApp({
      // Install the fetch-override mock on the BrowserContext BEFORE
      // firstWindow(). The renderer's initial load happens too early to
      // intercept (BrowserWindow.loadURL is called synchronously in main),
      // so we explicitly reload() below; the init script runs on that
      // reload's navigation and patches window.fetch before any user code.
      setupContext: (ctx) => installTrpcMockOnContext(ctx, { klines }),
    });
    // Trigger the navigation that runs the init script.
    await launched.window.reload();
    await launched.window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (launched) await closeApp(launched);
  });

  test('window opens and title is set', async () => {
    const title = await launched.window.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('renderer loads and chart canvas mounts', async () => {
    await launched.window.waitForFunction(
      () => document.querySelectorAll('canvas').length > 0,
      null,
      { timeout: 15_000 },
    );
    const canvasCount = await launched.window.evaluate(() =>
      document.querySelectorAll('canvas').length,
    );
    expect(canvasCount).toBeGreaterThan(0);
  });

  test('preload exposes window.electron bridge', async () => {
    const hasBridge = await launched.window.evaluate(() =>
      typeof (window as unknown as { electron?: unknown }).electron !== 'undefined',
    );
    expect(hasBridge).toBe(true);
  });

  test('perf overlay is reachable via window.__mmPerf', async () => {
    await launched.window.evaluate(() => {
      try {
        localStorage.setItem('chart.perf', '1');
      } catch {
        /* no-op */
      }
      const mm = (window as unknown as { __mmPerf?: { refreshFlag: () => void } }).__mmPerf;
      mm?.refreshFlag();
    });
    const snap = await launched.window.evaluate(() => {
      const mm = (window as unknown as {
        __mmPerf?: { getSnapshot: () => { enabled: boolean } };
      }).__mmPerf;
      return mm?.getSnapshot();
    });
    expect(snap?.enabled).toBe(true);
  });
});
