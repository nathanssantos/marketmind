export const BACKEND_HEALTH_SERVICE = 'marketmind-backend';
export const BACKEND_DEFAULT_PORT = 3001;
export const BACKEND_PORT_RANGE_SIZE = 21;
export const BACKEND_PROBE_TIMEOUT_MS = 1_000;
export const BACKEND_DISCOVERY_POLL_INTERVAL_MS = 250;

export const backendPortCandidates = (firstPort: number = BACKEND_DEFAULT_PORT): number[] =>
  Array.from({ length: BACKEND_PORT_RANGE_SIZE }, (_, offset) => firstPort + offset);

export const localBackendUrl = (port: number): string => `http://localhost:${String(port)}`;

export const isMarketMindBackend = async (port: number, fetchImpl: typeof fetch = fetch): Promise<boolean> => {
  try {
    const response = await fetchImpl(`${localBackendUrl(port)}/health`, { signal: AbortSignal.timeout(BACKEND_PROBE_TIMEOUT_MS) });
    if (!response.ok) return false;
    const body = (await response.json()) as { service?: unknown };
    return body.service === BACKEND_HEALTH_SERVICE;
  } catch {
    return false;
  }
};

export const findLocalBackendPort = async (fetchImpl: typeof fetch = fetch): Promise<number | null> => {
  const candidates = backendPortCandidates();
  const answers = await Promise.all(candidates.map((port) => isMarketMindBackend(port, fetchImpl)));
  const index = answers.indexOf(true);
  return index === -1 ? null : (candidates[index] ?? null);
};

export interface WaitForLocalBackendOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForLocalBackendUrl = async ({ timeoutMs, fetchImpl = fetch, now = Date.now, sleep = defaultSleep }: WaitForLocalBackendOptions): Promise<string | null> => {
  const deadline = now() + timeoutMs;
  for (;;) {
    const port = await findLocalBackendPort(fetchImpl);
    if (port !== null) return localBackendUrl(port);
    if (now() >= deadline) return null;
    await sleep(BACKEND_DISCOVERY_POLL_INTERVAL_MS);
  }
};
