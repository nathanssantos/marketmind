import { useApiBanStore } from '../store/apiBanStore';
import { useConnectionStore } from '../store/connectionStore';

const WS_CONNECTED_POLLING_MS = 5_000;

export const usePollingInterval = (fallbackMs: number): number | false => {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  const banExpiresAt = useApiBanStore((s) => s.banExpiresAt);
  if (banExpiresAt > Date.now()) return false;
  return wsConnected ? WS_CONNECTED_POLLING_MS : fallbackMs;
};
