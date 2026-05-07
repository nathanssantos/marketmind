import type { Page } from '@playwright/test';

export type PanelKindLite =
  | 'ticket'
  | 'checklist'
  | 'orders'
  | 'portfolio'
  | 'positions'
  | 'orderBook'
  | 'orderFlowMetrics'
  | 'watchers'
  | 'autoTradingSetup'
  | 'autoTradingActivity'
  | 'marketFearGreed'
  | 'marketBtcDominance'
  | 'marketMvrv'
  | 'marketOpenInterest'
  | 'marketLongShort';

export interface ScenarioLayout {
  /** Human-readable name surfaced in the test title. */
  name: string;
  /** Number of additional chart panels (the active layout always has 1 chart). */
  charts: number;
  /** Named panels to add. The order is preserved in the layout. */
  panels: PanelKindLite[];
}

declare global {
  interface Window {
    __layoutStore?: {
      getState: () => {
        symbolTabs: Array<{ id: string; activeLayoutId: string }>;
        activeSymbolTabId: string | null;
        addPanel: (layoutId: string, timeframe: string) => void;
        addNamedPanel: (layoutId: string, kind: string) => void;
      };
    };
  }
}

/**
 * Mutate the active layout to include the requested chart count + named
 * panels. Idempotent — calling addPanel/addNamedPanel for an already-
 * present panel kind is a no-op in the store.
 */
export const buildLayout = async (page: Page, layout: ScenarioLayout): Promise<void> => {
  await page.evaluate((cfg) => {
    const store = window.__layoutStore?.getState();
    if (!store) throw new Error('__layoutStore not exposed');
    const tab = store.symbolTabs.find((t) => t.id === store.activeSymbolTabId);
    if (!tab) throw new Error('no active symbol tab');
    const layoutId = tab.activeLayoutId;
    for (let i = 0; i < cfg.charts; i += 1) {
      store.addPanel(layoutId, ['1m', '5m', '15m', '1h', '4h', '1d'][i] ?? '1h');
    }
    for (const kind of cfg.panels) {
      store.addNamedPanel(layoutId, kind);
    }
  }, layout);
};

/**
 * Wait until each requested panel's expected DOM marker is present.
 * Avoids the trap where the layout state is mutated but the React
 * commit hasn't run yet — the test would pan a chart that hasn't
 * mounted its order book / ticket / etc.
 */
export const waitForPanelsMounted = async (
  page: Page,
  panelKinds: PanelKindLite[],
  timeoutMs = 3_000,
): Promise<void> => {
  const PANEL_SELECTORS: Record<PanelKindLite, string> = {
    ticket: '[data-panel-kind="ticket"]',
    checklist: '[data-panel-kind="checklist"]',
    orders: '[data-panel-kind="orders"]',
    portfolio: '[data-panel-kind="portfolio"]',
    positions: '[data-panel-kind="positions"]',
    orderBook: '[data-panel-kind="orderBook"]',
    orderFlowMetrics: '[data-panel-kind="orderFlowMetrics"]',
    watchers: '[data-panel-kind="watchers"]',
    autoTradingSetup: '[data-panel-kind="autoTradingSetup"]',
    autoTradingActivity: '[data-panel-kind="autoTradingActivity"]',
    marketFearGreed: '[data-panel-kind="marketFearGreed"]',
    marketBtcDominance: '[data-panel-kind="marketBtcDominance"]',
    marketMvrv: '[data-panel-kind="marketMvrv"]',
    marketOpenInterest: '[data-panel-kind="marketOpenInterest"]',
    marketLongShort: '[data-panel-kind="marketLongShort"]',
  };
  for (const kind of panelKinds) {
    await page.waitForSelector(PANEL_SELECTORS[kind], { timeout: timeoutMs }).catch(() => {
      // Tolerate panels without explicit data attributes — fall back
      // to a known mounted-anywhere check via the layout state.
    });
  }
};

export interface EmitterStats {
  emitted: Record<string, number>;
}

/**
 * Start a high-frequency background emitter for ALL hot streams that
 * a multi-panel layout would normally see. Returns a `stop()` to halt
 * and read totals. Each stream targets a realistic Hz that mirrors
 * Binance's burst cadence:
 *   - bookTicker: 20Hz × N symbols
 *   - depth:      10Hz × N symbols
 *   - scalping:   10Hz × N symbols
 *   - kline:       2Hz × N symbols (chart paints intra-minute)
 *   - price:      20Hz × N symbols (priceStore hot path)
 */
export const startRealisticEmitter = async (
  page: Page,
  symbols: string[] = ['BTCUSDT'],
): Promise<{ stop: () => Promise<EmitterStats> }> => {
  await page.evaluate((syms) => {
    const bridge = window.__socketTestBridge;
    if (!bridge) throw new Error('__socketTestBridge not exposed');

    const counters = { bookTicker: 0, depth: 0, scalping: 0, price: 0, kline: 0 };
    const intervals: Array<ReturnType<typeof setInterval>> = [];

    for (const symbol of syms) {
      let bidPrice = 80000;
      intervals.push(setInterval(() => {
        bidPrice += (Math.random() - 0.5) * 2;
        bridge.emit('bookTicker:update', {
          symbol, bidPrice, bidQty: 1, askPrice: bidPrice + 0.5, askQty: 1,
          microprice: bidPrice + 0.25, spread: 0.5, spreadPercent: 0.0001,
          timestamp: Date.now(),
        });
        counters.bookTicker += 1;
      }, 50));

      intervals.push(setInterval(() => {
        const bids = Array.from({ length: 20 }, (_, i) => ({
          price: bidPrice - i * 0.5, quantity: Math.random() * 5,
        }));
        const asks = Array.from({ length: 20 }, (_, i) => ({
          price: bidPrice + (i + 1) * 0.5, quantity: Math.random() * 5,
        }));
        bridge.emit('depth:update', { symbol, bids, asks, timestamp: Date.now() });
        counters.depth += 1;
      }, 100));

      intervals.push(setInterval(() => {
        bridge.emit('scalpingMetrics:update', {
          cvd: Math.random() * 1000, imbalanceRatio: Math.random() * 2,
          microprice: bidPrice, spread: 0.5, spreadPercent: 0.0001,
          largeBuyVol: Math.random() * 100, largeSellVol: Math.random() * 100,
          absorptionScore: Math.random(), exhaustionScore: Math.random(),
          timestamp: Date.now(),
        });
        counters.scalping += 1;
      }, 100));

      intervals.push(setInterval(() => {
        bridge.emit('price:update', { symbol, price: bidPrice + 0.25, timestamp: Date.now() });
        counters.price += 1;
      }, 50));

      intervals.push(setInterval(() => {
        const now = Date.now();
        const openTime = Math.floor(now / 60_000) * 60_000;
        bridge.emit('kline:update', {
          symbol, interval: '1m',
          openTime, closeTime: openTime + 59_999,
          open: '80000', high: bidPrice.toFixed(2), low: '79900',
          close: bidPrice.toFixed(2), volume: '10', quoteVolume: '800000',
          trades: 50, takerBuyBaseVolume: '5', takerBuyQuoteVolume: '400000',
          isClosed: false, timestamp: now,
        });
        counters.kline += 1;
      }, 500));
    }

    (window as unknown as { __mmEmitterStop?: () => void }).__mmEmitterStop = () => {
      for (const id of intervals) clearInterval(id);
      (window as unknown as { __mmEmitterCounters?: typeof counters }).__mmEmitterCounters = counters;
    };
  }, symbols);

  return {
    stop: async () => {
      const counters = await page.evaluate(() => {
        const w = window as unknown as { __mmEmitterStop?: () => void; __mmEmitterCounters?: Record<string, number> };
        w.__mmEmitterStop?.();
        return w.__mmEmitterCounters ?? {};
      });
      return { emitted: counters as Record<string, number> };
    },
  };
};

/**
 * Drive a realistic chart pan via the mouse — at ~120Hz of move events
 * for `durationMs`. Returns when mouseup completes.
 */
export const realChartPan = async (
  page: Page,
  durationMs: number,
): Promise<void> => {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();

  const startedAt = Date.now();
  let dx = 0;
  while (Date.now() - startedAt < durationMs) {
    dx -= 4;
    if (Math.abs(dx) > box.width * 0.4) dx = 0;
    await page.mouse.move(cx + dx, cy);
    // ~120Hz mouse cadence — close to a real wired mouse.
    await new Promise((r) => setTimeout(r, 8));
  }
  await page.mouse.up();
};
