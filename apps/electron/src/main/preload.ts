import type { AIMessage, AIPatternData, AIProviderType, AITrade, AITradingConfig, AITradingStats } from '@shared/types';
import type { TradingFees } from '@shared/types/fees';
import type { Order, Wallet } from '@shared/types/trading';
import { contextBridge, ipcRenderer } from 'electron';

type AIProvider = 'openai' | 'anthropic' | 'gemini';
type NewsProvider = 'newsapi' | 'cryptopanic';

interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  symbol?: string;
  patternDataId?: string;
}

interface AISettings {
  provider: AIProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedKlinesCount?: number;
}

interface AIData {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AISettings | null;
  enableAIPatterns: boolean;
  isAutoTradingActive?: boolean;
  tradingConfig?: AITradingConfig;
  trades?: AITrade[];
  tradingStats?: AITradingStats | null;
}

interface TradingData {
  wallets: Wallet[];
  orders: Order[];
  isSimulatorActive: boolean;
  activeWalletId: string | null;
  defaultQuantity: number;
  defaultExpiration: 'gtc' | 'day' | 'custom';
  quantityBySymbol?: Record<string, number>;
  tradingFees?: TradingFees;
}

interface SecureStorageAPI {
  isEncryptionAvailable: () => Promise<boolean>;
  setApiKey: (provider: AIProvider | NewsProvider, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; apiKey?: string | null; error?: string }>;
  deleteApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: (provider: AIProvider | NewsProvider) => Promise<boolean>;
  getAllApiKeys: () => Promise<Record<string, boolean>>;
  clearAllApiKeys: () => Promise<{ success: boolean; error?: string }>;
  getNewsSettings: () => Promise<{ enabled: boolean; refreshInterval: number; maxArticles: number }>;
  setNewsSettings: (settings: { enabled: boolean; refreshInterval: number; maxArticles: number; pollingEnabled?: boolean; minImportanceForToast?: number; correlateWithAI?: boolean }) => Promise<{ success: boolean; error?: string }>;
  getTradingData: () => Promise<{ success: boolean; data: TradingData | null; error?: string }>;
  setTradingData: (data: TradingData) => Promise<{ success: boolean; error?: string }>;
  clearTradingData: () => Promise<{ success: boolean; error?: string }>;
  getAIData: () => Promise<{ success: boolean; data: AIData | null; error?: string }>;
  setAIData: (data: AIData) => Promise<{ success: boolean; error?: string }>;
  clearAIData: () => Promise<{ success: boolean; error?: string }>;
  getAIPatterns: () => Promise<{ success: boolean; data: Record<string, AIPatternData>; error?: string }>;
  setAIPatterns: (patterns: Record<string, AIPatternData>) => Promise<{ success: boolean; error?: string }>;
  getAIPatternsForSymbol: (symbol: string) => Promise<{ success: boolean; data: AIPatternData | null; error?: string }>;
  setAIPatternsForSymbol: (symbol: string, data: AIPatternData) => Promise<{ success: boolean; error?: string }>;
  deleteAIPatternsForSymbol: (symbol: string) => Promise<{ success: boolean; error?: string }>;
  clearAIPatterns: () => Promise<{ success: boolean; error?: string }>;
}

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateError {
  message: string;
  stack?: string;
}

interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

interface NotificationAPI {
  show: (options: NotificationOptions) => Promise<{ success: boolean; error?: string }>;
  isSupported: () => Promise<boolean>;
}

interface UpdateAPI {
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  getInfo: () => Promise<{ currentVersion: string; platform: string }>;
  startAutoCheck: (intervalHours: number) => Promise<{ success: boolean; error?: string }>;
  stopAutoCheck: () => Promise<{ success: boolean; error?: string }>;
  onChecking: (callback: () => void) => void;
  onAvailable: (callback: (info: UpdateInfo) => void) => void;
  onNotAvailable: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: UpdateProgress) => void) => void;
  onDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onError: (callback: (error: UpdateError) => void) => void;
}

const API = {
  send: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data);
  },
  
  on: (channel: string, callback: (data: unknown) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },
  
  invoke: async (channel: string, data?: unknown) => {
    return await ipcRenderer.invoke(channel, data);
  },

  secureStorage: {
    isEncryptionAvailable: async () => {
      return await ipcRenderer.invoke('storage:isEncryptionAvailable');
    },
    
    setApiKey: async (provider: AIProvider | NewsProvider, apiKey: string) => {
      return await ipcRenderer.invoke('storage:setApiKey', provider, apiKey);
    },
    
    getApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:getApiKey', provider);
    },
    
    deleteApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:deleteApiKey', provider);
    },
    
    hasApiKey: async (provider: AIProvider | NewsProvider) => {
      return await ipcRenderer.invoke('storage:hasApiKey', provider);
    },

    getAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:getAllApiKeys');
    },

    clearAllApiKeys: async () => {
      return await ipcRenderer.invoke('storage:clearAllApiKeys');
    },
    
    getNewsSettings: async () => {
      return await ipcRenderer.invoke('storage:getNewsSettings');
    },

    setNewsSettings: async (settings: { enabled: boolean; refreshInterval: number; maxArticles: number; pollingEnabled?: boolean; minImportanceForToast?: number; correlateWithAI?: boolean }) => {
      return await ipcRenderer.invoke('storage:setNewsSettings', settings);
    },

    getTradingData: async () => {
      return await ipcRenderer.invoke('storage:getTradingData');
    },

    setTradingData: async (data: TradingData) => {
      return await ipcRenderer.invoke('storage:setTradingData', data);
    },

    clearTradingData: async () => {
      return await ipcRenderer.invoke('storage:clearTradingData');
    },

    getAIData: async () => {
      return await ipcRenderer.invoke('storage:getAIData');
    },

    setAIData: async (data: AIData) => {
      return await ipcRenderer.invoke('storage:setAIData', data);
    },

    clearAIData: async () => {
      return await ipcRenderer.invoke('storage:clearAIData');
    },

    getAIPatterns: async () => {
      return await ipcRenderer.invoke('storage:getAIPatterns');
    },

    setAIPatterns: async (patterns: Record<string, AIPatternData>) => {
      return await ipcRenderer.invoke('storage:setAIPatterns', patterns);
    },

    getAIPatternsForSymbol: async (symbol: string) => {
      return await ipcRenderer.invoke('storage:getAIPatternsForSymbol', symbol);
    },

    setAIPatternsForSymbol: async (symbol: string, data: AIPatternData) => {
      return await ipcRenderer.invoke('storage:setAIPatternsForSymbol', symbol, data);
    },

    deleteAIPatternsForSymbol: async (symbol: string) => {
      return await ipcRenderer.invoke('storage:deleteAIPatternsForSymbol', symbol);
    },

    clearAIPatterns: async () => {
      return await ipcRenderer.invoke('storage:clearAIPatterns');
    },
  } as SecureStorageAPI,

  update: {
    checkForUpdates: async () => {
      return await ipcRenderer.invoke('update:check');
    },

    downloadUpdate: async () => {
      return await ipcRenderer.invoke('update:download');
    },

    installUpdate: async () => {
      return await ipcRenderer.invoke('update:install');
    },

    getInfo: async () => {
      return await ipcRenderer.invoke('update:getInfo');
    },

    startAutoCheck: async (intervalHours: number) => {
      return await ipcRenderer.invoke('update:startAutoCheck', intervalHours);
    },

    stopAutoCheck: async () => {
      return await ipcRenderer.invoke('update:stopAutoCheck');
    },

    onChecking: (callback: () => void) => {
      ipcRenderer.on('update:checking', () => callback());
    },

    onAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:available', (_event, info) => callback(info));
    },

    onNotAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:not-available', (_event, info) => callback(info));
    },

    onDownloadProgress: (callback: (progress: UpdateProgress) => void) => {
      ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress));
    },

    onDownloaded: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update:downloaded', (_event, info) => callback(info));
    },

    onError: (callback: (error: UpdateError) => void) => {
      ipcRenderer.on('update:error', (_event, error) => callback(error));
    },
  } as UpdateAPI,

  http: {
    fetch: async (url: string, options?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
      return await ipcRenderer.invoke('http:fetch', url, options);
    },
  },

  notification: {
    show: async (options: NotificationOptions) => {
      return await ipcRenderer.invoke('notification:show', options);
    },

    isSupported: async () => {
      return await ipcRenderer.invoke('notification:isSupported');
    },
  } as NotificationAPI,
} as const;

contextBridge.exposeInMainWorld('electron', API);

export type ElectronAPI = typeof API;
