import { useCallback } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { immediateFlushPreferences } from '../store/preferencesStore';

interface UseChartWindowsResult {
  openChartWindow: (symbol?: string, timeframe?: string) => Promise<void>;
  getChartWindows: () => Promise<number[]>;
}

export const useChartWindows = (): UseChartWindowsResult => {
  const { window: windowAdapter } = usePlatform();

  const openChartWindow = useCallback(async (symbol?: string, timeframe?: string) => {
    try {
      await immediateFlushPreferences();
      const result = await windowAdapter.openChart(symbol, timeframe);
      if (!result.success) {
        console.error('Failed to open chart window:', result.error);
        throw new Error(result.error || 'Failed to open chart window');
      }
    } catch (error) {
      console.error('Error opening chart window:', error);
      throw error;
    }
  }, [windowAdapter]);

  const getChartWindows = useCallback(async () => {
    try {
      return await windowAdapter.getChartWindows();
    } catch (error) {
      console.error('Error getting chart windows:', error);
      return [];
    }
  }, [windowAdapter]);

  return {
    openChartWindow,
    getChartWindows,
  };
};
