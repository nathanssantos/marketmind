import type { AIMessage, AIPatternData, AIProviderType, AITrade, AITradingConfig, AITradingStats, Order, TradingFees, Wallet } from '@marketmind/types';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';
export type NewsProvider = 'newsapi' | 'cryptopanic';

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  symbol?: string;
  patternDataId?: string;
}

export interface AISettings {
  provider: AIProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedKlinesCount?: number;
}

export interface AIData {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AISettings | null;
  enableAIPatterns: boolean;
  isAutoTradingActive?: boolean;
  tradingConfig?: AITradingConfig;
  trades?: AITrade[];
  tradingStats?: AITradingStats | null;
}

export interface TradingData {
  wallets: Wallet[];
  orders: Order[];
  isSimulatorActive: boolean;
  activeWalletId: string | null;
  defaultQuantity: number;
  defaultExpiration: 'gtc' | 'day' | 'custom';
  quantityBySymbol?: Record<string, number>;
  tradingFees?: TradingFees;
}

export interface NewsSettings {
  enabled: boolean;
  refreshInterval: number;
  maxArticles: number;
  pollingEnabled?: boolean;
  minImportanceForToast?: number;
  correlateWithAI?: boolean;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateError {
  message: string;
  stack?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface StorageAdapter {
  isEncryptionAvailable: () => Promise<boolean>;
  setApiKey: (provider: AIProvider | NewsProvider, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; apiKey?: string | null; error?: string }>;
  deleteApiKey: (provider: AIProvider | NewsProvider) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: (provider: AIProvider | NewsProvider) => Promise<boolean>;
  getAllApiKeys: () => Promise<Record<string, boolean>>;
  clearAllApiKeys: () => Promise<{ success: boolean; error?: string }>;
  getNewsSettings: () => Promise<NewsSettings>;
  setNewsSettings: (settings: NewsSettings) => Promise<{ success: boolean; error?: string }>;
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

export interface UpdateAdapter {
  isSupported: () => boolean;
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

export interface NotificationAdapter {
  isSupported: () => Promise<boolean>;
  show: (options: NotificationOptions) => Promise<{ success: boolean; error?: string }>;
}

export interface WindowAdapter {
  openChart: (symbol?: string, timeframe?: string) => Promise<{ success: boolean; windowId?: number; error?: string }>;
  getChartWindows: () => Promise<number[]>;
}

export interface HttpAdapter {
  fetch: (url: string, options?: HttpOptions) => Promise<unknown>;
}

export interface PlatformAdapter {
  storage: StorageAdapter;
  update: UpdateAdapter;
  notification: NotificationAdapter;
  window: WindowAdapter;
  http: HttpAdapter;
  platform: 'electron' | 'web';
}
