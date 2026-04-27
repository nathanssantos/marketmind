import type { BrowserContext, Page, Route } from '@playwright/test';
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
    avatarColor: null,
    hasAvatar: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  'auth.getAvatar': () => null,
  'auth.listSessions': () => [
    {
      id: 'session_current',
      createdAt: '2026-04-20T10:00:00.000Z',
      expiresAt: '2026-05-20T10:00:00.000Z',
      userAgent: 'Chrome on macOS',
      ip: '192.168.1.10',
      isCurrent: true,
    },
  ],
  'auth.changePassword': () => ({ success: true }),
  'auth.uploadAvatar': () => ({ success: true }),
  'auth.deleteAvatar': () => ({ success: true }),
  'auth.updateProfile': () => ({ success: true }),
  'auth.revokeSession': () => ({ success: true }),
  'auth.revokeAllOtherSessions': () => ({ success: true }),
  'auth.resendVerificationEmail': () => ({ success: true }),
  'auth.toggleTwoFactor': () => ({ success: true, enabled: true }),
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

const resolveValue = (resolverMap: TrpcResolverMap, path: string, input: unknown): unknown => {
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

const buildBatchResponse = async (
  paths: string[],
  inputs: Record<string, unknown>,
  resolverMap: TrpcResolverMap,
): Promise<Array<{ result: { data: unknown } }>> =>
  Promise.all(
    paths.map(async (path, i) => {
      const input = unwrapJson(inputs[String(i)]);
      const data = await resolveValue(resolverMap, path, input);
      return { result: { data } };
    }),
  );

/**
 * Single source of truth for the resolver map composition. The factory for
 * `kline.list` accepts the raw klines explicitly so that the serialized form
 * (used by the Electron init-script adapter) can inline them — closures
 * don't survive the page.evaluate / addInitScript boundary.
 */
const makeKlineListResolver = (rawKlines: ReturnType<typeof toRawKline>[]): TrpcResolver =>
  (input: unknown) => {
    const limit = (input as { limit?: number } | undefined)?.limit;
    return typeof limit === 'number' ? rawKlines.slice(-limit) : rawKlines;
  };

const composeResolverMap = (options: TrpcMockOptions = {}): TrpcResolverMap => {
  const klines = options.klines ?? [];
  const rawKlines = klines.map(toRawKline);
  return {
    ...DEFAULT_RESPONSES,
    'kline.list': makeKlineListResolver(rawKlines),
    'kline.getCooldowns': () => [],
    'kline.getMaintenanceStatus': () => [],
    'kline.getDbSize': () => ({ bytes: 0 }),
    ...(options.overrides ?? {}),
  };
};

/**
 * Pre-serialize the resolver map so it can cross the page.evaluate boundary
 * (functions don't survive structured-clone). Each entry becomes either a
 * primitive value or a function source string that the renderer-side script
 * rehydrates with `new Function(...)`.
 */
interface SerializedResolver {
  path: string;
  isFn: boolean;
  value: unknown;
  fnSrc: string | null;
}

/**
 * Some resolvers (notably `kline.list`) close over data we can't push across
 * the script-boundary by reference. For those, we generate a fresh function
 * source that embeds the data as a JSON literal — the renderer-side function
 * has zero free variables.
 */
const serializeResolverMap = (
  resolverMap: TrpcResolverMap,
  inlineData: { klineList?: unknown[] } = {},
): SerializedResolver[] =>
  Object.entries(resolverMap).map(([path, resolver]) => {
    if (path === 'kline.list' && Array.isArray(inlineData.klineList)) {
      const inlinedJson = JSON.stringify(inlineData.klineList);
      return {
        path,
        isFn: true,
        value: null,
        fnSrc: `(input) => { const data = ${inlinedJson}; const limit = input && input.limit; return typeof limit === 'number' ? data.slice(-limit) : data; }`,
      };
    }
    return {
      path,
      isFn: typeof resolver === 'function',
      value: typeof resolver === 'function' ? null : resolver,
      fnSrc: typeof resolver === 'function' ? (resolver as TrpcResolver).toString() : null,
    };
  });

/**
 * page.route-based mock — used by chromium / visual / perf projects that
 * run in a plain Chromium browser via Playwright's webServer config.
 */
export const installTrpcMock = async (page: Page, options: TrpcMockOptions = {}): Promise<void> => {
  const resolverMap = composeResolverMap(options);

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

    const body = await buildBatchResponse(paths, inputs, resolverMap);
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

/**
 * Electron-friendly mock — installs a fetch monkey-patch via addInitScript
 * instead of page.route. Reason: Playwright's `page.route()` enables CDP
 * network interception that conflicts with Vite's ESM module loader inside
 * Electron renderer; on reload, all `/src/**` and `@vite/client` requests
 * fail with `net::ERR_FAILED` and React never mounts.
 *
 * Empirically reproduced: even a route pattern that NEVER matches Vite paths
 * (e.g. `http://localhost:3001/trpc/**`) still triggers the Vite-script
 * failures because turning on CDP request interception is global.
 * addInitScript-based fetch override is the only pattern that survives
 * reload in this stack — it operates entirely inside the renderer JS sandbox
 * and never engages Playwright's network layer.
 *
 * Reuses the same {@link composeResolverMap} factory as `installTrpcMock`,
 * so both adapters have a single source of truth for default responses,
 * kline shape, and per-test overrides.
 */
export const installTrpcMockOnContext = async (
  context: BrowserContext,
  options: TrpcMockOptions = {},
): Promise<void> => {
  const resolverMap = composeResolverMap(options);
  const klineRaw = (options.klines ?? []).map(toRawKline);
  const entries = serializeResolverMap(resolverMap, { klineList: klineRaw });

  await context.addInitScript((serialized: SerializedResolver[]) => {
    const map = new Map<string, (input: unknown) => unknown>();
    for (const e of serialized) {
      if (e.isFn && e.fnSrc) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
          const fn = new Function(`return (${e.fnSrc})`)() as (input: unknown) => unknown;
          map.set(e.path, fn);
        } catch {
          map.set(e.path, () => e.value);
        }
      } else {
        map.set(e.path, () => e.value);
      }
    }

    const counters = new Map<string, number>();
    (window as unknown as { __mmTrpcCounters: Map<string, number> }).__mmTrpcCounters = counters;
    (window as unknown as { __mmTrpcHits: (path: string) => number }).__mmTrpcHits = (path: string) =>
      counters.get(path) ?? 0;

    const unwrap = (value: unknown): unknown =>
      value && typeof value === 'object' && 'json' in (value as Record<string, unknown>)
        ? (value as { json: unknown }).json
        : value;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      if (!rawUrl.includes('/trpc/')) {
        return originalFetch(input, init);
      }
      const url = new URL(rawUrl, window.location.origin);
      const pathPart = url.pathname.replace(/^.*\/trpc\//, '');
      const paths = pathPart.split(',');

      let inputs: Record<string, unknown> = {};
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        const raw = url.searchParams.get('input');
        if (raw) {
          try { inputs = JSON.parse(raw) as Record<string, unknown>; }
          catch { inputs = {}; }
        }
      } else if (init?.body) {
        try { inputs = JSON.parse(String(init.body)) as Record<string, unknown>; }
        catch { inputs = {}; }
      }

      for (const p of paths) counters.set(p, (counters.get(p) ?? 0) + 1);

      const body = paths.map((path, i) => {
        const resolver = map.get(path);
        const inputValue = unwrap(inputs[String(i)]);
        const data = resolver ? resolver(inputValue) : null;
        return { result: { data } };
      });

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }, entries);
};
