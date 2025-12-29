import type { StorageAdapter, TradingData } from '../types';

const STORAGE_KEYS = {
  TRADING_DATA: 'marketmind-trading-data',
} as const;

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const createWebStorageAdapter = (): StorageAdapter => ({
  isEncryptionAvailable: async () => true,

  getTradingData: async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRADING_DATA);
      const data = safeJsonParse<TradingData | null>(stored, null);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get trading data';
      return { success: false, data: null, error: message };
    }
  },

  setTradingData: async (data: TradingData) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRADING_DATA, JSON.stringify(data));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save trading data';
      return { success: false, error: message };
    }
  },

  clearTradingData: async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TRADING_DATA);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear trading data';
      return { success: false, error: message };
    }
  },
});
