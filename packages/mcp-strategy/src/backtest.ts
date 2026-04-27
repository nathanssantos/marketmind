/**
 * Thin wrapper around the backend's tRPC `backtest.run` procedure. Lets agents
 * kick off a backtest without needing to drive the UI.
 */

const TRPC_BASE_URL = process.env.MM_MCP_TRPC_URL ?? 'http://localhost:3001/trpc';
const SESSION_COOKIE = process.env.MM_MCP_SESSION_COOKIE ?? '';

interface TrpcSuccess { result: { data: unknown } }
interface TrpcError { error: { message: string; code: number; data?: unknown } }

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (SESSION_COOKIE) h['cookie'] = SESSION_COOKIE;
  return h;
};

const callTrpc = async (path: string, input: unknown): Promise<unknown> => {
  const res = await fetch(`${TRPC_BASE_URL}/${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input ?? {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`tRPC ${path}: non-JSON response (${res.status})`);
  }
  const body = parsed as TrpcSuccess | TrpcError;
  if ('error' in body) throw new Error(`tRPC ${path}: ${body.error.message}`);
  return body.result.data;
};

export interface BacktestRunInput {
  strategyId: string;
  symbol: string;
  interval: string;
  startTime: string;
  endTime: string;
  initialBalance?: number;
  exchange?: 'BINANCE' | 'INTERACTIVE_BROKERS';
  assetClass?: 'CRYPTO' | 'STOCKS';
  params?: Record<string, unknown>;
}

export const runBacktest = async (input: BacktestRunInput): Promise<unknown> => {
  return callTrpc('backtest.run', input);
};

export const getBacktestResult = async (id: string): Promise<unknown> => {
  return callTrpc('backtest.getResult', { id });
};

export const listBacktests = async (): Promise<unknown> => {
  return callTrpc('backtest.list', {});
};

export const getTrpcUrl = (): string => TRPC_BASE_URL;
