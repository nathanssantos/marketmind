import type { BrowserContext } from 'playwright';
import { type Fixture, VISUAL_REVIEW_FIXTURES } from './fixtures.js';

/**
 * Install a fetch monkey-patch in every page of the given context that
 * intercepts `/trpc/...` requests and returns canned visual-review fixtures.
 *
 * Implementation note (Electron-safe): we use addInitScript instead of
 * page.route because Playwright's page.route enables CDP request
 * interception, which conflicts with Vite's ESM module loader in the Electron
 * renderer. addInitScript runs entirely inside the renderer JS sandbox.
 *
 * The handler replicates tRPC's batched-procedure-call wire format:
 * `/trpc/auth.me,wallet.list?input=...` returns `[{result:{data:...}},...]`.
 */
export const installVisualFixtures = async (
  context: BrowserContext,
  extra: Fixture[] = [],
): Promise<void> => {
  const merged = [...VISUAL_REVIEW_FIXTURES, ...extra];
  await context.addInitScript((entries: Fixture[]) => {
    const map = new Map<string, unknown>(entries.map((e) => [e.path, e.value]));

    // Expose the kline map to the page so the marketing-screenshots
    // script can read it (needed for seedLivePrices, which pushes the
    // synthetic last-close into the priceStore so unrealized PnL math
    // doesn't fall through to the entryPrice fallback).
    const klineMap = map.get('_klineMap');
    if (klineMap) {
      (window as Window & { __klineMapCache?: unknown }).__klineMapCache = klineMap;
    }

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

      // Special path: `_klineMap` is a Record<symbol-interval, Kline[]> the
      // mock dispatches on for `kline.list`. Lets a single fixture cover
      // every (symbol, interval) combination the renderer asks for, instead
      // of every chart panel rendering the same series.
      const klineMap = map.get('_klineMap') as Record<string, unknown> | undefined;

      const body = paths.map((path, i) => {
        const input = unwrap(inputs[String(i)]) as Record<string, unknown> | undefined;
        if (path === 'kline.list' && klineMap && input) {
          const sym = input.symbol as string | undefined;
          const intv = input.interval as string | undefined;
          const key = `${sym}:${intv}`;
          const series = klineMap[key];
          return { result: { data: series ?? [] } };
        }
        const data = map.has(path) ? map.get(path) : null;
        return { result: { data } };
      });

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }, merged);
};
