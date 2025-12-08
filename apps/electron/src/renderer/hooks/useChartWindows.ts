import { useCallback } from 'react';

interface UseChartWindowsResult {
  openChartWindow: (symbol?: string) => Promise<void>;
  getChartWindows: () => Promise<number[]>;
}

export const useChartWindows = (): UseChartWindowsResult => {
  const openChartWindow = useCallback(async (symbol?: string) => {
    try {
      const result = await window.electron.window.openChart(symbol);
      if (!result.success) {
        console.error('Failed to open chart window:', result.error);
        throw new Error(result.error || 'Failed to open chart window');
      }
    } catch (error) {
      console.error('Error opening chart window:', error);
      throw error;
    }
  }, []);

  const getChartWindows = useCallback(async () => {
    try {
      return await window.electron.window.getChartWindows();
    } catch (error) {
      console.error('Error getting chart windows:', error);
      return [];
    }
  }, []);

  return {
    openChartWindow,
    getChartWindows,
  };
};
