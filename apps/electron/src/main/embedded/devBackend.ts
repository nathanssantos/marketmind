import { readFileSync } from 'node:fs';

export const DEFAULT_DEV_BACKEND_URL = 'http://localhost:3001';
export const BACKEND_HEALTH_SERVICE = 'marketmind-backend';
export const DEV_BACKEND_POLL_INTERVAL_MS = 250;
export const DEV_BACKEND_HEALTH_TIMEOUT_MS = 1_500;

interface RuntimeFileContent {
  service?: string;
  url?: string;
}

export const readRuntimeBackendUrl = (runtimeFile: string): string | null => {
  try {
    const content = JSON.parse(readFileSync(runtimeFile, 'utf8')) as RuntimeFileContent;
    return content.service === BACKEND_HEALTH_SERVICE && typeof content.url === 'string' ? content.url : null;
  } catch {
    return null;
  }
};

export const isMarketMindBackend = async (url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> => {
  try {
    const response = await fetchImpl(`${url}/health`, { signal: AbortSignal.timeout(DEV_BACKEND_HEALTH_TIMEOUT_MS) });
    if (!response.ok) return false;
    const body = (await response.json()) as { service?: string };
    return body.service === BACKEND_HEALTH_SERVICE;
  } catch {
    return false;
  }
};

export interface DiscoverDevBackendOptions {
  runtimeFile: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const discoverDevBackendUrl = async ({ runtimeFile, timeoutMs, fetchImpl = fetch, now = Date.now, sleep = defaultSleep }: DiscoverDevBackendOptions): Promise<string> => {
  const deadline = now() + timeoutMs;
  for (;;) {
    const url = readRuntimeBackendUrl(runtimeFile);
    if (url && (await isMarketMindBackend(url, fetchImpl))) return url;
    if (now() >= deadline) return DEFAULT_DEV_BACKEND_URL;
    await sleep(DEV_BACKEND_POLL_INTERVAL_MS);
  }
};
