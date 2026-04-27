/**
 * Thin tRPC HTTP bridge. Constructs requests in the shape Fastify-tRPC expects
 * (`/trpc/{path}`) and forwards an optional session cookie so the call is
 * authenticated as the dev user.
 *
 * Strictly read/idempotent calls only — mutations should go through the app UI
 * (mcp-app) or be deferred to mcp-trading (planned for v1.2).
 */

const TRPC_BASE_URL = process.env.MM_MCP_TRPC_URL ?? 'http://localhost:3001/trpc';
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
  const url = `${TRPC_BASE_URL}/${path}`;
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
  const url = `${TRPC_BASE_URL}/health.check`;
  try {
    const res = await fetch(url, { method: 'POST', headers: headers(), body: '{}' });
    return { ok: res.ok, status: res.status, baseUrl: TRPC_BASE_URL };
  } catch {
    return { ok: false, status: 0, baseUrl: TRPC_BASE_URL };
  }
};

export const getTrpcBaseUrl = (): string => TRPC_BASE_URL;
