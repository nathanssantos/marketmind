import type { WindowAdapter } from '../types';

const openWindows: Map<number, Window | null> = new Map();
let windowIdCounter = 0;

export const createWebWindowAdapter = (): WindowAdapter => ({
  openChart: async (symbol = 'BTCUSDT', timeframe = '1d') => {
    try {
      const windowId = ++windowIdCounter;
      const url = `/chart/${symbol}/${timeframe}`;
      const features = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';

      const newWindow = window.open(url, `chart_${windowId}`, features);

      if (!newWindow) {
        return {
          success: false,
          error: 'Popup blocked. Please allow popups for this site.',
        };
      }

      openWindows.set(windowId, newWindow);

      const checkInterval = setInterval(() => {
        if (newWindow.closed) {
          openWindows.delete(windowId);
          clearInterval(checkInterval);
        }
      }, 1000);

      return { success: true, windowId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open chart window';
      return { success: false, error: message };
    }
  },

  getChartWindows: async () => {
    const activeIds: number[] = [];
    openWindows.forEach((win, id) => {
      if (win && !win.closed) {
        activeIds.push(id);
      } else {
        openWindows.delete(id);
      }
    });
    return activeIds;
  },
});
