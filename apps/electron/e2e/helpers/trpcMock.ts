import type { Page, Route } from '@playwright/test';
import { toRawKline, type TestKline } from './klineFixtures';

type TrpcResolver = (input: unknown) => unknown;
type TrpcResolverMap = Record<string, TrpcResolver | unknown>;

export interface TrpcMockOptions {
  klines?: TestKline[];
  overrides?: TrpcResolverMap;
}

const DEFAULT_RESPONSES: TrpcResolverMap = {
  'auth.me': () => ({
    id: 'e2e-user',
    email: 'e2e@test.local',
    name: 'E2E Test User',
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  'wallet.list': () => [],
  'wallet.listActive': () => [],
  'trading.getOrders': () => [],
  'trading.getPositions': () => [],
  'trading.getTradeExecutions': () => [],
  'trading.getTickerPrices': () => ({}),
  'futuresTrading.getOpenOrders': () => [],
  'futuresTrading.getOpenAlgoOrders': () => [],
  'futuresTrading.getOpenDbOrderIds': () => [],
  'autoTrading.getConfig': () => null,
  'autoTrading.getActiveExecutions': () => [],
  'autoTrading.getExecutionHistory': () => [],
  'autoTrading.getRecentLogs': () => [],
  'autoTrading.getWatcherStatus': () => [],
  'ticker.getDailyBatch': () => [],
  'customSymbol.list': () => [],
  'userIndicators.list': () => [],
  'setup.getConfig': () => null,
  'signalSuggestions.list': () => [],
  'preferences.getByCategory': () => [],
  'preferences.getAll': () => [],
  'drawing.list': () => [],
  'layout.get': () => null,
  'screener.getPresets': () => [],
  'screener.getSavedScreeners': () => [],
  'fees.getUserFees': () => null,
  'orderSync.getStatus': () => ({ lastSyncAt: null, isRunning: false }),
  'heatmap.getAlwaysCollectSymbols': () => [],
};

const resolve = (resolverMap: TrpcResolverMap, path: string, input: unknown): unknown => {
  const resolver = resolverMap[path];
  if (resolver === undefined) return null;
  if (typeof resolver === 'function') return (resolver as TrpcResolver)(input);
  return resolver;
};

const unwrapJson = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'json' in (value as Record<string, unknown>)) {
    return (value as { json: unknown }).json;
  }
  return value;
};

const parseBatchInput = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const buildBatchResponse = (
  paths: string[],
  inputs: Record<string, unknown>,
  resolverMap: TrpcResolverMap,
): Array<{ result: { data: unknown } }> =>
  paths.map((path, i) => {
    const input = unwrapJson(inputs[String(i)]);
    const data = resolve(resolverMap, path, input);
    return { result: { data } };
  });

export const installTrpcMock = async (page: Page, options: TrpcMockOptions = {}): Promise<void> => {
  const klines = options.klines ?? [];
  const rawKlines = klines.map(toRawKline);
  const resolverMap: TrpcResolverMap = {
    ...DEFAULT_RESPONSES,
    'kline.list': (input: unknown) => {
      const limit = (input as { limit?: number } | undefined)?.limit;
      return typeof limit === 'number' ? rawKlines.slice(-limit) : rawKlines;
    },
    'kline.getCooldowns': () => [],
    'kline.getMaintenanceStatus': () => [],
    'kline.getDbSize': () => ({ bytes: 0 }),
    ...(options.overrides ?? {}),
  };

  await page.exposeFunction('__mmTrpcHitCount', () => 0);

  await page.addInitScript(() => {
    const counters = new Map<string, number>();
    (window as unknown as { __mmTrpcCounters: Map<string, number> }).__mmTrpcCounters = counters;
    (window as unknown as { __mmTrpcHits: (path: string) => number }).__mmTrpcHits = (path: string) =>
      counters.get(path) ?? 0;
  });

  await page.route('**/trpc/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathPart = url.pathname.replace(/^.*\/trpc\//, '');
    const paths = pathPart.split(',');

    let inputs: Record<string, unknown> = {};
    if (request.method() === 'GET') {
      inputs = parseBatchInput(url.searchParams.get('input'));
    } else {
      try {
        inputs = (request.postDataJSON() as Record<string, unknown>) ?? {};
      } catch {
        inputs = {};
      }
    }

    await page.evaluate((pathsToCount: string[]) => {
      const counters = (window as unknown as { __mmTrpcCounters: Map<string, number> }).__mmTrpcCounters;
      if (!counters) return;
      for (const path of pathsToCount) {
        counters.set(path, (counters.get(path) ?? 0) + 1);
      }
    }, paths).catch(() => { /* best effort — ignore if page not ready */ });

    const body = buildBatchResponse(paths, inputs, resolverMap);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
};

/**
 * Read how many times a given tRPC path was hit by the mock.
 * Handy for asserting that a WS event triggered a React Query invalidation → refetch.
 */
export const getTrpcHitCount = (page: Page, path: string): Promise<number> =>
  page.evaluate((p: string) => {
    const reader = (window as unknown as { __mmTrpcHits?: (path: string) => number }).__mmTrpcHits;
    return reader ? reader(p) : 0;
  }, path);
