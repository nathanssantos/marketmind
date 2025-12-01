import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workerPool } from './WorkerPool';

describe('WorkerPool', () => {
  let mockWorker: Worker;
  let workerFactory: () => Worker;

  beforeEach(() => {
    workerPool.terminateAll();

    mockWorker = {
      terminate: vi.fn(),
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      onerror: null,
    } as unknown as Worker;

    workerFactory = vi.fn(() => mockWorker);
  });

  describe('register', () => {
    it('should register a worker factory', () => {
      workerPool.register('test-worker', workerFactory);
      const worker = workerPool.get('test-worker');

      expect(worker).toBe(mockWorker);
      expect(workerFactory).toHaveBeenCalledTimes(1);
    });

    it('should allow registering multiple factories', () => {
      const mockWorker2 = { ...mockWorker, terminate: vi.fn() } as unknown as Worker;
      const workerFactory2 = vi.fn(() => mockWorker2);

      workerPool.register('worker-1', workerFactory);
      workerPool.register('worker-2', workerFactory2);

      const worker1 = workerPool.get('worker-1');
      const worker2 = workerPool.get('worker-2');

      expect(worker1).toBe(mockWorker);
      expect(worker2).toBe(mockWorker2);
    });
  });

  describe('get', () => {
    it('should return null when factory not registered', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const worker = workerPool.get('non-existent');

      expect(worker).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('No worker factory registered for key: non-existent');

      consoleSpy.mockRestore();
    });

    it('should create worker on first access', () => {
      workerPool.register('test-worker', workerFactory);

      const worker = workerPool.get('test-worker');

      expect(worker).toBe(mockWorker);
      expect(workerFactory).toHaveBeenCalledTimes(1);
    });

    it('should return cached worker on subsequent access', () => {
      workerPool.register('test-worker', workerFactory);

      const worker1 = workerPool.get('test-worker');
      const worker2 = workerPool.get('test-worker');

      expect(worker1).toBe(worker2);
      expect(workerFactory).toHaveBeenCalledTimes(1);
    });

    it('should create different workers for different keys', () => {
      const mockWorker2 = { ...mockWorker, terminate: vi.fn() } as unknown as Worker;
      const workerFactory2 = vi.fn(() => mockWorker2);

      workerPool.register('worker-1', workerFactory);
      workerPool.register('worker-2', workerFactory2);

      const worker1 = workerPool.get('worker-1');
      const worker2 = workerPool.get('worker-2');

      expect(worker1).not.toBe(worker2);
      expect(workerFactory).toHaveBeenCalledTimes(1);
      expect(workerFactory2).toHaveBeenCalledTimes(1);
    });
  });

  describe('has', () => {
    it('should return false when worker not created', () => {
      workerPool.register('test-worker', workerFactory);

      expect(workerPool.has('test-worker')).toBe(false);
    });

    it('should return true when worker exists', () => {
      workerPool.register('test-worker', workerFactory);
      workerPool.get('test-worker');

      expect(workerPool.has('test-worker')).toBe(true);
    });

    it('should return false for non-registered worker', () => {
      expect(workerPool.has('non-existent')).toBe(false);
    });
  });

  describe('terminate', () => {
    it('should terminate and remove worker', () => {
      workerPool.register('test-worker', workerFactory);
      workerPool.get('test-worker');

      workerPool.terminate('test-worker');

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(workerPool.has('test-worker')).toBe(false);
    });

    it('should do nothing when terminating non-existent worker', () => {
      workerPool.terminate('non-existent');

      expect(workerPool.has('non-existent')).toBe(false);
    });

    it('should allow re-creating worker after termination', () => {
      workerPool.register('test-worker', workerFactory);
      workerPool.get('test-worker');

      workerPool.terminate('test-worker');

      expect(workerFactory).toHaveBeenCalledTimes(1);

      const newWorker = workerPool.get('test-worker');

      expect(newWorker).toBe(mockWorker);
      expect(workerFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('terminateAll', () => {
    it('should terminate all workers', () => {
      const mockWorker2 = {
        terminate: vi.fn(),
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onmessage: null,
        onmessageerror: null,
        onerror: null,
      } as unknown as Worker;

      const workerFactory2 = vi.fn(() => mockWorker2);

      workerPool.register('worker-1', workerFactory);
      workerPool.register('worker-2', workerFactory2);

      workerPool.get('worker-1');
      workerPool.get('worker-2');

      workerPool.terminateAll();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
      expect(mockWorker2.terminate).toHaveBeenCalledTimes(1);
      expect(workerPool.has('worker-1')).toBe(false);
      expect(workerPool.has('worker-2')).toBe(false);
    });

    it('should work with no workers', () => {
      expect(() => workerPool.terminateAll()).not.toThrow();
    });

    it('should clear all workers from pool', () => {
      workerPool.register('worker-1', workerFactory);
      workerPool.register('worker-2', workerFactory);

      workerPool.get('worker-1');
      workerPool.get('worker-2');

      expect(workerPool.has('worker-1')).toBe(true);
      expect(workerPool.has('worker-2')).toBe(true);

      workerPool.terminateAll();

      expect(workerPool.has('worker-1')).toBe(false);
      expect(workerPool.has('worker-2')).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should handle multiple register-get-terminate cycles', () => {
      workerPool.register('test-worker', workerFactory);

      workerPool.get('test-worker');
      workerPool.terminate('test-worker');

      workerPool.get('test-worker');
      workerPool.terminate('test-worker');

      expect(workerFactory).toHaveBeenCalledTimes(2);
      expect(mockWorker.terminate).toHaveBeenCalledTimes(2);
    });
  });
});
