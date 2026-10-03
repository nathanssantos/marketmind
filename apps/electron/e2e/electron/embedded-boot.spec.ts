import { expect, test, type ElectronApplication } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMBEDDED_BOOT_TIMEOUT_MS,
  createUserDataDir,
  launchEmbeddedApp,
  removeUserDataDir,
  waitForRendererWindow,
} from './embedded-launch';

test.describe('embedded stack', () => {
  let userDataDir: string;
  let app: ElectronApplication;

  test.beforeAll(async () => {
    userDataDir = createUserDataDir();
    app = await launchEmbeddedApp(userDataDir);
  });

  test.afterAll(async () => {
    await app.close();
    removeUserDataDir(userDataDir);
  });

  test('boots PostgreSQL and the backend, then serves the login page from the backend origin', async () => {
    test.setTimeout(EMBEDDED_BOOT_TIMEOUT_MS + 30_000);
    const page = await waitForRendererWindow(app);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 60_000 });
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);

    const health = await page.evaluate(async () => (await fetch('/health')).json() as Promise<{ status: string }>);
    expect(health.status).toBe('ok');

    expect(existsSync(join(userDataDir, 'data', 'postgres', 'PG_VERSION'))).toBe(true);
    expect(existsSync(join(userDataDir, 'secrets.json'))).toBe(true);
  });

  test('stops PostgreSQL when the app closes', async () => {
    await app.close();
    const pidFile = join(userDataDir, 'data', 'postgres', 'postmaster.pid');
    await expect.poll(() => existsSync(pidFile), { timeout: 30_000 }).toBe(false);
    app = await launchEmbeddedApp(userDataDir);
    const page = await waitForRendererWindow(app);
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 60_000 });
  });
});
