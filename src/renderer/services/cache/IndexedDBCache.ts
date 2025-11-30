export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  openTime?: number;
  expiresAt: number;
}

export class IndexedDBCache {
  private dbName: string = 'marketmind-cache';
  private version: number = 1;
  private storeName: string = 'cache';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
          objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(key);

      request.onerror = () => {
        reject(new Error('Failed to get cache entry'));
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        if (Date.now() > entry.expiresAt) {
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(entry.value);
      };
    });
  }

  async set<T>(key: string, value: T, ttlMs: number = 60000): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      openTime: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(entry);

      request.onerror = () => {
        reject(new Error('Failed to set cache entry'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(key);

      request.onerror = () => {
        reject(new Error('Failed to delete cache entry'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear cache'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  async cleanExpired(): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onerror = () => {
        reject(new Error('Failed to clean expired entries'));
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  async getSize(): Promise<number> {
    if (!this.db) await this.initialize();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.count();

      request.onerror = () => {
        reject(new Error('Failed to get cache size'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAllKeys();

      request.onerror = () => {
        reject(new Error('Failed to get all keys'));
      };

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const indexedDBCache = new IndexedDBCache();
