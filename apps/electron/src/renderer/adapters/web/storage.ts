import type { AIPatternData } from '@marketmind/types';
import type { StorageAdapter, AIData, TradingData, NewsSettings, AIProvider, NewsProvider } from '../types';
import { trpc } from '../../services/trpc';

const STORAGE_KEYS = {
  NEWS_SETTINGS: 'marketmind-news-settings',
  TRADING_DATA: 'marketmind-trading-data',
  AI_DATA: 'marketmind-ai-data',
  AI_PATTERNS: 'marketmind-ai-patterns',
} as const;

const DEFAULT_NEWS_SETTINGS: NewsSettings = {
  enabled: false,
  refreshInterval: 300000,
  maxArticles: 50,
  pollingEnabled: false,
  minImportanceForToast: 3,
  correlateWithAI: false,
};

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

  setApiKey: async (provider: AIProvider | NewsProvider, apiKey: string) => {
    try {
      await trpc.apiKey.set.mutate({ provider, key: apiKey });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save API key';
      return { success: false, error: message };
    }
  },

  getApiKey: async (provider: AIProvider | NewsProvider) => {
    try {
      const result = await trpc.apiKey.get.query({ provider });
      return { success: true, apiKey: result.key };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get API key';
      return { success: false, error: message };
    }
  },

  deleteApiKey: async (provider: AIProvider | NewsProvider) => {
    try {
      await trpc.apiKey.delete.mutate({ provider });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete API key';
      return { success: false, error: message };
    }
  },

  hasApiKey: async (provider: AIProvider | NewsProvider) => {
    try {
      const result = await trpc.apiKey.get.query({ provider });
      return result.key !== null;
    } catch {
      return false;
    }
  },

  getAllApiKeys: async () => {
    try {
      return await trpc.apiKey.list.query();
    } catch {
      return { openai: false, anthropic: false, gemini: false, newsapi: false, cryptopanic: false };
    }
  },

  clearAllApiKeys: async () => {
    try {
      await trpc.apiKey.clearAll.mutate();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear API keys';
      return { success: false, error: message };
    }
  },

  getNewsSettings: async () => {
    const stored = localStorage.getItem(STORAGE_KEYS.NEWS_SETTINGS);
    return safeJsonParse(stored, DEFAULT_NEWS_SETTINGS);
  },

  setNewsSettings: async (settings: NewsSettings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.NEWS_SETTINGS, JSON.stringify(settings));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save news settings';
      return { success: false, error: message };
    }
  },

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

  getAIData: async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_DATA);
      const data = safeJsonParse<AIData | null>(stored, null);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get AI data';
      return { success: false, data: null, error: message };
    }
  },

  setAIData: async (data: AIData) => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_DATA, JSON.stringify(data));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI data';
      return { success: false, error: message };
    }
  },

  clearAIData: async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AI_DATA);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear AI data';
      return { success: false, error: message };
    }
  },

  getAIPatterns: async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_PATTERNS);
      const data = safeJsonParse<Record<string, AIPatternData>>(stored, {});
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get AI patterns';
      return { success: false, data: {}, error: message };
    }
  },

  setAIPatterns: async (patterns: Record<string, AIPatternData>) => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_PATTERNS, JSON.stringify(patterns));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI patterns';
      return { success: false, error: message };
    }
  },

  getAIPatternsForSymbol: async (symbol: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_PATTERNS);
      const patterns = safeJsonParse<Record<string, AIPatternData>>(stored, {});
      return { success: true, data: patterns[symbol] || null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get AI patterns for symbol';
      return { success: false, data: null, error: message };
    }
  },

  setAIPatternsForSymbol: async (symbol: string, data: AIPatternData) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_PATTERNS);
      const patterns = safeJsonParse<Record<string, AIPatternData>>(stored, {});
      patterns[symbol] = data;
      localStorage.setItem(STORAGE_KEYS.AI_PATTERNS, JSON.stringify(patterns));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save AI patterns for symbol';
      return { success: false, error: message };
    }
  },

  deleteAIPatternsForSymbol: async (symbol: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AI_PATTERNS);
      const patterns = safeJsonParse<Record<string, AIPatternData>>(stored, {});
      delete patterns[symbol];
      localStorage.setItem(STORAGE_KEYS.AI_PATTERNS, JSON.stringify(patterns));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete AI patterns for symbol';
      return { success: false, error: message };
    }
  },

  clearAIPatterns: async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AI_PATTERNS);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear AI patterns';
      return { success: false, error: message };
    }
  },
});
