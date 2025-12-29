import type { Order, Wallet } from '@marketmind/types';
import * as electron from 'electron';
import ElectronStore from 'electron-store';

const { safeStorage } = electron;

interface SecureStoreSchema {
  tradingData?: {
    wallets: Wallet[];
    orders: Order[];
    isSimulatorActive: boolean;
    activeWalletId: string | null;
    defaultQuantity: number;
    defaultExpiration: 'gtc' | 'day' | 'custom';
  };
  version: string;
}

export class StorageService {
  private store: ElectronStore<SecureStoreSchema>;

  constructor() {
    this.store = new ElectronStore<SecureStoreSchema>({
      name: 'marketmind-secure',
      defaults: {
        version: '1.0.0',
      },
    });
  }

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
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

  getVersion(): string {
    return this.store.get('version', '1.0.0');
  }

  clear(): void {
    this.store.clear();
  }
}

export const storageService = new StorageService();
