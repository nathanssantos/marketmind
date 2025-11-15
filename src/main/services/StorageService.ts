import { safeStorage } from 'electron';
import Store from 'electron-store';

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
  version: string;
}

export class StorageService {
  private store: Store<SecureStoreSchema>;

  constructor() {
    this.store = new Store<SecureStoreSchema>({
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
    } catch (error) {
      console.error(`Failed to encrypt ${provider} API key:`, error);
      throw new Error(`Failed to encrypt ${provider} API key`);
    }
  }

  getApiKey(provider: 'openai' | 'anthropic' | 'gemini' | 'newsapi' | 'cryptopanic'): string | null {
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

  getVersion(): string {
    return this.store.get('version', '1.0.0');
  }

  clear(): void {
    this.store.clear();
  }
}

export const storageService = new StorageService();
