import { useConnectionStore } from '../store/connectionStore';

const WS_CONNECTED_POLLING_MS = 30_000;

export const usePollingInterval = (fallbackMs: number): number => {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  return wsConnected ? WS_CONNECTED_POLLING_MS : fallbackMs;
};
