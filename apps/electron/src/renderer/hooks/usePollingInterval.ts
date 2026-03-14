import { useConnectionStore } from '../store/connectionStore';

export const usePollingInterval = (fallbackMs: number): number | false => {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  return wsConnected ? false : fallbackMs;
};
