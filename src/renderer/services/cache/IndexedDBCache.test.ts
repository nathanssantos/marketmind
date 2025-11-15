import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { indexedDBCache } from './IndexedDBCache';

describe('IndexedDBCache', () => {
  beforeEach(async () => {
    await indexedDBCache.initialize();
    await indexedDBCache.clear();
  });

  afterEach(async () => {
    await indexedDBCache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve data', async () => {
      const key = 'test-key';
      const value = { foo: 'bar', num: 123 };

      await indexedDBCache.set(key, value, 60000);
      const result = await indexedDBCache.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await indexedDBCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      const key = 'expired-key';
      const value = { data: 'test' };

      await indexedDBCache.set(key, value, 10);
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const result = await indexedDBCache.get(key);
      expect(result).toBeNull();
    });

    it('should handle complex nested objects', async () => {
      const key = 'complex-key';
      const value = {
        nested: {
          array: [1, 2, 3],
          object: { a: 1, b: 2 },
        },
        timestamp: Date.now(),
      };

      await indexedDBCache.set(key, value);
      const result = await indexedDBCache.get(key);

      expect(result).toEqual(value);
    });
  });

  describe('delete', () => {
    it('should delete entries', async () => {
      const key = 'delete-test';
      await indexedDBCache.set(key, { data: 'test' });

      await indexedDBCache.delete(key);
      const result = await indexedDBCache.get(key);

      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent keys', async () => {
      await expect(indexedDBCache.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await indexedDBCache.set('key1', { data: 1 });
      await indexedDBCache.set('key2', { data: 2 });
      await indexedDBCache.set('key3', { data: 3 });

      await indexedDBCache.clear();

      const result1 = await indexedDBCache.get('key1');
      const result2 = await indexedDBCache.get('key2');
      const result3 = await indexedDBCache.get('key3');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe('cleanExpired', () => {
    it('should remove expired entries only', async () => {
      await indexedDBCache.set('valid', { data: 'valid' }, 60000);
      await indexedDBCache.set('expired', { data: 'expired' }, 10);

      await new Promise(resolve => setTimeout(resolve, 20));
      await indexedDBCache.cleanExpired();

      const validResult = await indexedDBCache.get('valid');
      const expiredResult = await indexedDBCache.get('expired');

      expect(validResult).toEqual({ data: 'valid' });
      expect(expiredResult).toBeNull();
    });
  });

  describe('getSize', () => {
    it('should return correct cache size', async () => {
      expect(await indexedDBCache.getSize()).toBe(0);

      await indexedDBCache.set('key1', { data: 1 });
      expect(await indexedDBCache.getSize()).toBe(1);

      await indexedDBCache.set('key2', { data: 2 });
      expect(await indexedDBCache.getSize()).toBe(2);

      await indexedDBCache.delete('key1');
      expect(await indexedDBCache.getSize()).toBe(1);
    });
  });

  describe('getAllKeys', () => {
    it('should return all cache keys', async () => {
      await indexedDBCache.set('key1', { data: 1 });
      await indexedDBCache.set('key2', { data: 2 });
      await indexedDBCache.set('key3', { data: 3 });

      const keys = await indexedDBCache.getAllKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array when cache is empty', async () => {
      const keys = await indexedDBCache.getAllKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL values', async () => {
      await indexedDBCache.set('short-ttl', { data: 'short' }, 50);
      await indexedDBCache.set('long-ttl', { data: 'long' }, 5000);

      await new Promise(resolve => setTimeout(resolve, 100));

      const shortResult = await indexedDBCache.get('short-ttl');
      const longResult = await indexedDBCache.get('long-ttl');

      expect(shortResult).toBeNull();
      expect(longResult).toEqual({ data: 'long' });
    });

    it('should use default TTL if not specified', async () => {
      await indexedDBCache.set('default-ttl', { data: 'test' });
      
      const result = await indexedDBCache.get('default-ttl');
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const mockCache = new (indexedDBCache.constructor as any)();
      
      await expect(mockCache.get('test')).resolves.not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        indexedDBCache.set(`concurrent-${i}`, { value: i })
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();

      const size = await indexedDBCache.getSize();
      expect(size).toBe(10);
    });
  });
});
