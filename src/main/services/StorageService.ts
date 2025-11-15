import Store from 'electron-store';
import { safeStorage } from 'electron';

interface SecureStoreSchema {
  encryptedApiKey?: string;
  version: string;
}

export class StorageService {
  private store: Store<SecureStoreSchema>;

  constructor() {
    this.store = new Store<SecureStoreSchema>({
      name: 'marketmind-secure',
      defaults: {
        version: '1.0.0',
      },
    });
  }

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  setApiKey(apiKey: string): void {
    if (!this.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this platform');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key');
    }

    try {
      const buffer = safeStorage.encryptString(apiKey);
      const encrypted = buffer.toString('base64');
      this.store.set('encryptedApiKey', encrypted);
    } catch (error) {
      console.error('Failed to encrypt API key:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  getApiKey(): string | null {
    if (!this.isEncryptionAvailable()) {
      console.warn('Encryption is not available on this platform');
      return null;
    }

    const encrypted = this.store.get('encryptedApiKey');
    
    if (!encrypted) {
      return null;
    }

    try {
      const buffer = Buffer.from(encrypted, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }

  deleteApiKey(): void {
    this.store.delete('encryptedApiKey');
  }

  hasApiKey(): boolean {
    return this.store.has('encryptedApiKey');
  }

  getVersion(): string {
    return this.store.get('version', '1.0.0');
  }

  clear(): void {
    this.store.clear();
  }
}

export const storageService = new StorageService();
