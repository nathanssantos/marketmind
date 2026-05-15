import { test, expect } from '@playwright/test';
import { launchApp, closeApp, type LaunchedApp } from './app-launch';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMockOnContext } from '../helpers/trpcMock';
import { openToolsItem } from '../helpers/toolsMenu';

let launched: LaunchedApp;

test.describe('Backtest modal — inside packaged Electron app', () => {
  test.beforeAll(async () => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    launched = await launchApp({
      setupContext: (ctx) => installTrpcMockOnContext(ctx, {
        klines,
        overrides: {
          'setupDetection.listStrategies': () => [
            {
              id: 'breakout-retest',
              name: 'Breakout Retest',
              version: '1.0',
              description: 'Detects breakout-and-retest setups',
              author: 'mm',
              tags: ['breakout'],
              status: 'active',
              enabled: true,
              recommendedTimeframes: { primary: '1h' },
            },
          ],
          'backtest.run': () => ({ backtestId: 'bt-electron' }),
          'backtest.list': () => [],
        },
      }),
    });
    await launched.window.reload();
    await launched.window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (launched) await closeApp(launched);
  });

  test('toolbar trigger opens the modal with all four tabs visible', async () => {
    const toolsBtn = launched.window.locator('[data-testid="toolbar-tools-button"]');
    await expect(toolsBtn).toBeVisible({ timeout: 15_000 });
    await openToolsItem(launched.window, 'backtest');

    const dialog = launched.window.getByRole('dialog', { name: 'Backtest' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Basic' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Strategies' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Filters' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Risk' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Run backtest' })).toBeEnabled();

    // Strategies tab is wired via the same listStrategies query — confirm
    // the fixture renders.
    await dialog.getByRole('tab', { name: 'Strategies' }).click();
    await expect(dialog.getByText('Breakout Retest', { exact: true })).toBeVisible();

    await launched.window.keyboard.press('Escape');
    await expect(launched.window.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
  });

  test('Cmd/Ctrl+Shift+B keyboard shortcut toggles the modal', async () => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await expect(launched.window.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
    await launched.window.keyboard.press(`${modifier}+Shift+KeyB`);
    await expect(launched.window.getByRole('dialog', { name: 'Backtest' })).toBeVisible();
    await launched.window.keyboard.press(`${modifier}+Shift+KeyB`);
    await expect(launched.window.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
  });
});
