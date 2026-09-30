/**
 * Thin tRPC HTTP bridge. Constructs requests in the shape Fastify-tRPC expects
 * (`/trpc/{path}`) and forwards an optional session cookie so the call is
 * authenticated as the dev user.
 *
 * Strictly read/idempotent calls only — mutations should go through the app UI
 * (mcp-app) or be deferred to mcp-trading (planned for v1.2).
 */

const DEFAULT_TRPC_BASE_URL = 'http://localhost:3001/trpc';
const BACKEND_HEALTH_SERVICE = 'marketmind-backend';
const BACKEND_FIRST_PORT = 3001;
const BACKEND_PORT_RANGE_SIZE = 21;
const BACKEND_PROBE_TIMEOUT_MS = 1_000;

const localBackendUrl = (port: number): string => `http://localhost:${String(port)}`;

const isMarketMindBackend = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`${localBackendUrl(port)}/health`, { signal: AbortSignal.timeout(BACKEND_PROBE_TIMEOUT_MS) });
    if (!response.ok) return false;
    const body = (await response.json()) as { service?: unknown };
    return body.service === BACKEND_HEALTH_SERVICE;
  } catch {
    return false;
  }
};

const findLocalBackendPort = async (): Promise<number | null> => {
  const ports = Array.from({ length: BACKEND_PORT_RANGE_SIZE }, (_, offset) => BACKEND_FIRST_PORT + offset);
  const answers = await Promise.all(ports.map(isMarketMindBackend));
  const index = answers.indexOf(true);
  return index === -1 ? null : (ports[index] ?? null);
};

let discoveredBaseUrl: string | null = null;

const resolveTrpcBaseUrl = async (): Promise<string> => {
  if (process.env.MM_MCP_TRPC_URL) return process.env.MM_MCP_TRPC_URL;
  if (discoveredBaseUrl) return discoveredBaseUrl;
  const port = await findLocalBackendPort();
  if (port === null) return DEFAULT_TRPC_BASE_URL;
  discoveredBaseUrl = `${localBackendUrl(port)}/trpc`;
  return discoveredBaseUrl;
};
const SESSION_COOKIE = process.env.MM_MCP_SESSION_COOKIE ?? '';

interface TrpcSuccess { result: { data: unknown } }
interface TrpcError {
  error: { message: string; code: number; data?: { code?: string; httpStatus?: number } };
}

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (SESSION_COOKIE) h['cookie'] = SESSION_COOKIE;
  return h;
};

export const callProcedure = async (path: string, input: unknown): Promise<unknown> => {
  if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(path)) {
    throw new Error(`invalid tRPC path: ${path}`);
  }
  // tRPC v11 query/mutation both accept POST; we use POST for everything.
  const url = `${await resolveTrpcBaseUrl()}/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input ?? {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`tRPC ${path}: non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = parsed as TrpcSuccess | TrpcError;
  if ('error' in body) {
    throw new Error(`tRPC ${path}: ${body.error.message}`);
  }
  return body.result.data;
};

export const trpcHealthCheck = async (): Promise<{ ok: boolean; status: number; baseUrl: string }> => {
  const url = `${await resolveTrpcBaseUrl()}/health.check`;
  try {
    const res = await fetch(url, { method: 'POST', headers: headers(), body: '{}' });
    return { ok: res.ok, status: res.status, baseUrl: await resolveTrpcBaseUrl() };
  } catch {
    return { ok: false, status: 0, baseUrl: await resolveTrpcBaseUrl() };
  }
};

export const getTrpcBaseUrl = (): Promise<string> => resolveTrpcBaseUrl();
