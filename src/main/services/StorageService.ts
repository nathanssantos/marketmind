import type { AIMessage, AIProviderType, AIStudyData, AITrade, AITradingConfig, AITradingStats } from '@shared/types';
import type { Order, Wallet } from '@shared/types/trading';
import * as electron from 'electron';
import ElectronStore from 'electron-store';

const { safeStorage } = electron;

interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  symbol?: string;
  studyDataId?: string;
}

interface AISettings {
  provider: AIProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedCandlesCount?: number;
}

interface SecureStoreSchema {
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    newsapi?: string;
    cryptopanic?: string;
  };
  newsSettings?: {
    enabled: boolean;
    refreshInterval: number;
    maxArticles: number;
  };
  tradingData?: {
    wallets: Wallet[];
    orders: Order[];
    isSimulatorActive: boolean;
    activeWalletId: string | null;
    defaultQuantity: number;
    defaultExpiration: 'gtc' | 'day' | 'custom';
  };
  aiData?: {
    conversations: Conversation[];
    activeConversationId: string | null;
    settings: AISettings | null;
    enableAIStudies: boolean;
    isAutoTradingActive?: boolean;
    tradingConfig?: AITradingConfig;
    trades?: AITrade[];
    tradingStats?: AITradingStats | null;
  };
  aiStudies?: Record<string, AIStudyData>;
  version: string;
}

export class StorageService {
  private store: ElectronStore<SecureStoreSchema>;
  private keyCache: Map<string, { key: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000;

  constructor() {
    this.store = new ElectronStore<SecureStoreSchema>({
      name: 'marketmind-secure',
      defaults: {
        version: '1.0.0',
        apiKeys: {},
      },
    });
  }

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  setApiKey(provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic', apiKey: string): void {
    if (!this.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this platform');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key');
    }

    try {
      const buffer = safeStorage.encryptString(apiKey);
      const encrypted = buffer.toString('base64');
      
      const apiKeys = this.store.get('apiKeys', {});
      this.store.set('apiKeys', {
        ...apiKeys,
        [provider]: encrypted,
      });

      this.keyCache.set(provider, {
        key: apiKey,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`Failed to encrypt ${provider} API key:`, error);
      throw new Error(`Failed to encrypt ${provider} API key`);
    }
  }

  getApiKey(provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic'): string | null {
    const cached = this.keyCache.get(provider);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.key;
    }

    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption is not available on this platform');
      return null;
    }

    const apiKeys = this.store.get('apiKeys', {});
    const encrypted = apiKeys[provider];
    
    if (!encrypted) {
      return null;
    }

    try {
      const buffer = Buffer.from(encrypted, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      
      this.keyCache.set(provider, {
        key: decrypted,
        timestamp: Date.now(),
      });
      
      return decrypted;
    } catch (error) {
      console.error(`Failed to decrypt ${provider} API key:`, error);
      return null;
    }
  }

  deleteApiKey(provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic'): void {
    const apiKeys = this.store.get('apiKeys', {});
    delete apiKeys[provider];
    this.store.set('apiKeys', apiKeys);
    this.keyCache.delete(provider);
  }

  hasApiKey(provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic'): boolean {
    const apiKeys = this.store.get('apiKeys', {});
    return !!apiKeys[provider];
  }

  getAllApiKeys(): Record<string, boolean> {
    const apiKeys = this.store.get('apiKeys', {});
    return {
      openai: !!apiKeys.openai,
      anthropic: !!apiKeys.anthropic,
      gemini: !!apiKeys.gemini,
      newsapi: !!apiKeys.newsapi,
      cryptopanic: !!apiKeys.cryptopanic,
    };
  }

  clearAllApiKeys(): void {
    this.store.set('apiKeys', {});
    this.keyCache.clear();
  }

  getNewsSettings(): { enabled: boolean; refreshInterval: number; maxArticles: number } {
    return this.store.get('newsSettings', {
      enabled: false,
      refreshInterval: 5,
      maxArticles: 10,
    });
  }

  setNewsSettings(settings: { enabled: boolean; refreshInterval: number; maxArticles: number }): void {
    this.store.set('newsSettings', settings);
  }

  getTradingData(): SecureStoreSchema['tradingData'] | null {
    const data = this.store.get('tradingData');
    return data !== undefined ? data : null;
  }

  setTradingData(data: SecureStoreSchema['tradingData']): void {
    this.store.set('tradingData', data);
  }

  clearTradingData(): void {
    this.store.delete('tradingData');
  }

  getAIData(): SecureStoreSchema['aiData'] | null {
    const data = this.store.get('aiData');
    return data !== undefined ? data : null;
  }

  setAIData(data: SecureStoreSchema['aiData']): void {
    this.store.set('aiData', data);
  }

  clearAIData(): void {
    this.store.delete('aiData');
  }

  getAIStudies(): Record<string, AIStudyData> {
    return this.store.get('aiStudies', {});
  }

  setAIStudies(studies: Record<string, AIStudyData>): void {
    this.store.set('aiStudies', studies);
  }

  getAIStudiesForSymbol(symbol: string): AIStudyData | null {
    const studies = this.getAIStudies();
    return studies[symbol] || null;
  }

  setAIStudiesForSymbol(symbol: string, data: AIStudyData): void {
    const studies = this.getAIStudies();
    studies[symbol] = data;
    this.setAIStudies(studies);
  }

  deleteAIStudiesForSymbol(symbol: string): void {
    const studies = this.getAIStudies();
    delete studies[symbol];
    this.setAIStudies(studies);
  }

  clearAIStudies(): void {
    this.store.delete('aiStudies');
  }

  getVersion(): string {
    return this.store.get('version', '1.0.0');
  }

  clear(): void {
    this.store.clear();
  }
}

export const storageService = new StorageService();
