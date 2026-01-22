import { describe, it, expect, beforeEach } from 'vitest';
import { ChaosMonkey, NetworkChaos, ResourceChaos } from './chaos-utils';

describe('Chaos Testing - System Resilience', () => {
  describe('ChaosMonkey', () => {
    let chaos: ChaosMonkey;

    beforeEach(() => {
      chaos = new ChaosMonkey({ failureRate: 0.5, enabled: true });
    });

    it('should inject failures at configured rate', () => {
      const iterations = 1000;
      let failures = 0;

      for (let i = 0; i < iterations; i++) {
        if (chaos.shouldFail()) failures++;
      }

      const rate = failures / iterations;
      expect(rate).toBeGreaterThan(0.4);
      expect(rate).toBeLessThan(0.6);
    });

    it('should not inject failures when disabled', () => {
      chaos.disable();
      const iterations = 100;
      let failures = 0;

      for (let i = 0; i < iterations; i++) {
        if (chaos.shouldFail()) failures++;
      }

      expect(failures).toBe(0);
    });

    it('should throw errors when failure triggered', () => {
      chaos.setFailureRate(1);

      expect(() => chaos.maybeThrowError('Test failure')).toThrow('Test failure');
    });

    it('should not throw errors when failure not triggered', () => {
      chaos.setFailureRate(0);

      expect(() => chaos.maybeThrowError('Test failure')).not.toThrow();
    });

    it('should inject latency within configured range', async () => {
      chaos = new ChaosMonkey({
        latencyMin: 50,
        latencyMax: 150,
        enabled: true,
      });

      const start = Date.now();
      await chaos.maybeInjectLatency();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('NetworkChaos', () => {
    let network: NetworkChaos;

    beforeEach(() => {
      network = new NetworkChaos(0.5, 0.3);
    });

    it('should drop packets at configured rate', () => {
      const iterations = 1000;
      let dropped = 0;

      for (let i = 0; i < iterations; i++) {
        if (network.shouldDropPacket()) dropped++;
      }

      const rate = dropped / iterations;
      expect(rate).toBeGreaterThan(0.4);
      expect(rate).toBeLessThan(0.6);
    });

    it('should corrupt string data when triggered', () => {
      network = new NetworkChaos(0, 1);
      const original = 'Hello World';
      const corrupted = network.corruptData(original);

      expect(corrupted).not.toBe(original);
      expect(corrupted.length).toBe(original.length);
    });

    it('should not corrupt data when disabled', () => {
      network.disable();
      const original = 'Hello World';
      const result = network.corruptData(original);

      expect(result).toBe(original);
    });

    it('should corrupt numeric data when triggered', () => {
      network = new NetworkChaos(0, 1);
      const original = 100;

      let hasCorrupted = false;
      for (let i = 0; i < 100; i++) {
        const corrupted = network.corruptData(original);
        if (corrupted !== original) {
          hasCorrupted = true;
          expect(corrupted).toBeCloseTo(original, -1);
          break;
        }
      }

      expect(hasCorrupted).toBe(true);
    });
  });

  describe('ResourceChaos', () => {
    let resource: ResourceChaos;

    beforeEach(() => {
      resource = new ResourceChaos();
    });

    it('should not run resource pressure when disabled', async () => {
      const start = Date.now();
      await resource.simulateMemoryPressure(10, 100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should simulate CPU spike when enabled', async () => {
      resource.enable();
      const start = Date.now();
      await resource.simulateCpuSpike(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Service Recovery Patterns', () => {
    it('should recover from transient failures with retry', async () => {
      let attempts = 0;
      const failUntilAttempt = 3;

      const operationWithRetry = async (maxRetries: number): Promise<string> => {
        for (let i = 0; i < maxRetries; i++) {
          attempts++;
          try {
            if (attempts < failUntilAttempt) {
              throw new Error('Transient failure');
            }
            return 'success';
          } catch {
            if (i === maxRetries - 1) throw new Error('Max retries exceeded');
            await new Promise((r) => setTimeout(r, 10));
          }
        }
        throw new Error('Unexpected');
      };

      const result = await operationWithRetry(10);
      expect(result).toBe('success');
      expect(attempts).toBe(failUntilAttempt);
    });

    it('should implement circuit breaker pattern', () => {
      const chaos = new ChaosMonkey({ failureRate: 1, enabled: true });
      let circuitOpen = false;
      let failures = 0;
      const failureThreshold = 5;

      const operationWithCircuitBreaker = (): string => {
        if (circuitOpen) {
          throw new Error('Circuit breaker open');
        }

        try {
          chaos.maybeThrowError('Service failure');
          failures = 0;
          return 'success';
        } catch {
          failures++;
          if (failures >= failureThreshold) {
            circuitOpen = true;
          }
          throw new Error('Operation failed');
        }
      };

      for (let i = 0; i < failureThreshold; i++) {
        expect(() => operationWithCircuitBreaker()).toThrow('Operation failed');
      }

      expect(() => operationWithCircuitBreaker()).toThrow('Circuit breaker open');
    });

    it('should implement bulkhead pattern for isolation', async () => {
      const bulkheadSize = 3;
      let activeOperations = 0;
      let maxConcurrent = 0;

      const operationWithBulkhead = async (): Promise<void> => {
        if (activeOperations >= bulkheadSize) {
          throw new Error('Bulkhead limit reached');
        }

        activeOperations++;
        maxConcurrent = Math.max(maxConcurrent, activeOperations);

        await new Promise((r) => setTimeout(r, 50));
        activeOperations--;
      };

      const operations = Array(5)
        .fill(null)
        .map(() => operationWithBulkhead().catch(() => {}));

      await Promise.all(operations);

      expect(maxConcurrent).toBeLessThanOrEqual(bulkheadSize);
    });

    it('should handle timeout pattern', async () => {
      const timeout = 50;

      const operationWithTimeout = async (
        operation: () => Promise<string>,
        timeoutMs: number
      ): Promise<string> => {
        return Promise.race([
          operation(),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
          ),
        ]);
      };

      const slowOperation = (): Promise<string> =>
        new Promise((resolve) => setTimeout(() => resolve('done'), 200));

      await expect(operationWithTimeout(slowOperation, timeout)).rejects.toThrow(
        'Operation timed out'
      );

      const fastOperation = (): Promise<string> =>
        new Promise((resolve) => setTimeout(() => resolve('done'), 10));

      await expect(operationWithTimeout(fastOperation, timeout)).resolves.toBe('done');
    });
  });

  describe('Data Integrity Under Chaos', () => {
    it('should maintain data consistency with idempotent operations', () => {
      const state = { counter: 0 };
      const processedIds = new Set<string>();

      const idempotentIncrement = (operationId: string): void => {
        if (processedIds.has(operationId)) return;
        processedIds.add(operationId);
        state.counter++;
      };

      idempotentIncrement('op-1');
      idempotentIncrement('op-1');
      idempotentIncrement('op-1');

      expect(state.counter).toBe(1);
    });

    it('should handle partial failures with compensation', () => {
      const operations: string[] = [];
      const compensations: string[] = [];

      const saga = (): void => {
        const executeStep = (name: string, shouldFail: boolean): void => {
          operations.push(name);
          if (shouldFail) throw new Error(`${name} failed`);
        };

        const compensateStep = (name: string): void => {
          compensations.push(`compensate-${name}`);
        };

        try {
          executeStep('step-1', false);
          executeStep('step-2', false);
          executeStep('step-3', true);
        } catch {
          const reversedOps = [...operations].reverse();
          for (const op of reversedOps) {
            compensateStep(op);
          }
        }
      };

      saga();

      expect(operations).toEqual(['step-1', 'step-2', 'step-3']);
      expect(compensations).toEqual([
        'compensate-step-3',
        'compensate-step-2',
        'compensate-step-1',
      ]);
    });
  });
});
