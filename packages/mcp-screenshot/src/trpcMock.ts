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

      const body = paths.map((path, i) => {
        const data = map.has(path) ? map.get(path) : null;
        // Touch inputs for prefix paths in case future fixtures want them.
        unwrap(inputs[String(i)]);
        return { result: { data } };
      });

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }, merged);
};
