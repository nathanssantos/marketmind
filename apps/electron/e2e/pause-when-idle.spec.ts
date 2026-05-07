import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForSocket } from './helpers/socketBridge';
import { waitForChartReady } from './helpers/chartTestSetup';
import { buildLayout, waitForPanelsMounted } from './helpers/realPanScenario';

declare global {
  interface Window {
    __layoutStore?: {
      getState: () => {
        symbolTabs: Array<{ id: string; activeLayoutId: string }>;
        activeSymbolTabId: string | null;
        layoutPresets: Array<{ id: string; grid: Array<{ id: string; kind?: string }> }>;
        addNamedPanel: (layoutId: string, kind: string) => void;
        removePanel: (layoutId: string, panelId: string) => void;
        setPanelWindowState: (layoutId: string, panelId: string, state: 'normal' | 'minimized' | 'maximized') => void;
      };
    };
    __socketTestBridge?: {
      emit: (event: string, payload: unknown) => void;
      getListenerCount: (event: string) => number;
      getBusListenerCount: (event: string) => number;
      getActiveRoomCount: () => number;
      listEvents: () => string[];
    };
  }
}

const findPanelId = async (page: import('@playwright/test').Page, kind: string): Promise<string> =>
  page.evaluate((k) => {
    const store = window.__layoutStore?.getState();
    if (!store || !store.activeSymbolTabId) throw new Error('layout store not ready');
    const tab = store.symbolTabs.find((t) => t.id === store.activeSymbolTabId)!;
    const layout = store.layoutPresets.find((l) => l.id === tab.activeLayoutId)!;
    const panel = layout.grid.find((p) => p.kind === k);
    if (!panel) throw new Error(`no ${k} panel found`);
    return panel.id;
  }, kind);

const layoutId = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => {
    const store = window.__layoutStore!.getState();
    return store.symbolTabs.find((t) => t.id === store.activeSymbolTabId)!.activeLayoutId;
  });

test.describe('pauseWhenIdle: WS subscription release on panel unmount', () => {
  test.setTimeout(45_000);

  test('order book panel: minimizing releases the depth listener', async ({ page }) => {
    const klines = generateKlines({ count: 100, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForSocket(page);

    // Baseline: no orderBook panel → no listener for depth:update.
    expect(await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('depth:update'))).toBe(0);

    // Mount the orderBook panel.
    await buildLayout(page, { name: 'with-orderBook', charts: 0, panels: ['orderBook'] });
    await waitForPanelsMounted(page, ['orderBook']);
    // Brief settle so the React commit + Suspense lazy import finish.
    await page.waitForTimeout(500);

    // Listener count should be ≥1 now (useDepth via useLiveStream).
    const mounted = await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('depth:update'));
    expect(mounted, 'depth:update should have at least one listener while orderBook is mounted').toBeGreaterThan(0);

    // Minimize the panel — `ChartGrid` filters minimized panels out of
    // `panelsToRender`, so the panel UNMOUNTS. Hooks clean up. The bus
    // listener vanishes; the server's depth subscription is released
    // via `subscribeRoom`'s ref-counter.
    const id = await findPanelId(page, 'orderBook');
    const lid = await layoutId(page);
    await page.evaluate(({ layoutId: l, panelId }) => {
      window.__layoutStore!.getState().setPanelWindowState(l, panelId, 'minimized');
    }, { layoutId: lid, panelId: id });
    await page.waitForTimeout(300);

    expect(
      await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('depth:update')),
      'depth:update listener should be released after minimize'
    ).toBe(0);

    // Restore — listener comes back.
    await page.evaluate(({ layoutId: l, panelId }) => {
      window.__layoutStore!.getState().setPanelWindowState(l, panelId, 'normal');
    }, { layoutId: lid, panelId: id });
    await page.waitForTimeout(500);

    expect(
      await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('depth:update'))
    ).toBeGreaterThan(0);
  });

  test('multiple consumers of the same stream: ref-count holds while ANY panel is open', async ({ page }) => {
    const klines = generateKlines({ count: 100, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForSocket(page);

    // Mount BOTH ticket (uses useBookTicker) and orderFlowMetrics
    // (uses useScalpingMetrics — different stream, but useful as a
    // bystander to confirm the ref-counter is stream-specific).
    await buildLayout(page, {
      name: 'two-consumers',
      charts: 0,
      panels: ['ticket', 'orderFlowMetrics'],
    });
    await waitForPanelsMounted(page, ['ticket', 'orderFlowMetrics']);
    await page.waitForTimeout(500);

    const bookTickerListeners = await page.evaluate(
      () => window.__socketTestBridge!.getBusListenerCount('bookTicker:update'),
    );
    const scalpingListeners = await page.evaluate(
      () => window.__socketTestBridge!.getBusListenerCount('scalpingMetrics:update'),
    );
    expect(bookTickerListeners, 'ticket → bookTicker').toBeGreaterThan(0);
    expect(scalpingListeners, 'orderFlowMetrics → scalpingMetrics').toBeGreaterThan(0);

    // Remove the ticket panel — bookTicker listener should drop to
    // zero, scalpingMetrics should be untouched.
    const ticketId = await findPanelId(page, 'ticket');
    const lid = await layoutId(page);
    await page.evaluate(({ layoutId: l, panelId }) => {
      window.__layoutStore!.getState().removePanel(l, panelId);
    }, { layoutId: lid, panelId: ticketId });
    await page.waitForTimeout(300);

    expect(
      await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('bookTicker:update')),
      'bookTicker should release when ticket unmounts'
    ).toBe(0);
    expect(
      await page.evaluate(() => window.__socketTestBridge!.getBusListenerCount('scalpingMetrics:update')),
      'scalpingMetrics should stay active while orderFlowMetrics is mounted'
    ).toBeGreaterThan(0);
  });
});
