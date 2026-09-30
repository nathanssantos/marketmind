import { BACKEND_DEFAULT_PORT, localBackendUrl, waitForLocalBackendUrl } from '@marketmind/utils';

export const DEFAULT_DEV_BACKEND_URL = localBackendUrl(BACKEND_DEFAULT_PORT);

export interface DiscoverDevBackendOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export const discoverDevBackendUrl = async (options: DiscoverDevBackendOptions): Promise<string> =>
  (await waitForLocalBackendUrl(options)) ?? DEFAULT_DEV_BACKEND_URL;
