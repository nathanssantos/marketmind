import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RollingWindowRateLimiter,
  PerContractRateLimiter,
  PacingViolationHandler,
} from '../../exchange/interactive-brokers/backfill-service';

describe('RollingWindowRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create limiter with specified limit and window', () => {
      const limiter = new RollingWindowRateLimiter(10, 60000);
      expect(limiter.availableSlots).toBe(10);
    });
  });

  describe('acquire', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RollingWindowRateLimiter(3, 1000);

      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.availableSlots).toBe(0);
    });

    it('should block when limit is reached', async () => {
      const limiter = new RollingWindowRateLimiter(2, 1000);

      await limiter.acquire();
      await limiter.acquire();

      const acquirePromise = limiter.acquire();
      await vi.advanceTimersByTimeAsync(1100);
      await acquirePromise;

      expect(limiter.availableSlots).toBe(1);
    });
  });

  describe('availableSlots', () => {
    it('should return full capacity when empty', () => {
      const limiter = new RollingWindowRateLimiter(5, 1000);
      expect(limiter.availableSlots).toBe(5);
    });

    it('should decrease after acquire', async () => {
      const limiter = new RollingWindowRateLimiter(5, 1000);
      await limiter.acquire();
      expect(limiter.availableSlots).toBe(4);
    });

    it('should recover after window expires', async () => {
      const limiter = new RollingWindowRateLimiter(5, 1000);

      await limiter.acquire();
      await limiter.acquire();
      expect(limiter.availableSlots).toBe(3);

      vi.advanceTimersByTime(1100);
      expect(limiter.availableSlots).toBe(5);
    });
  });

  describe('nextAvailableIn', () => {
    it('should return 0 when slots available', () => {
      const limiter = new RollingWindowRateLimiter(5, 1000);
      expect(limiter.nextAvailableIn).toBe(0);
    });

    it('should return time until next slot when full', async () => {
      const limiter = new RollingWindowRateLimiter(1, 1000);

      await limiter.acquire();
      vi.advanceTimersByTime(500);

      const nextAvailable = limiter.nextAvailableIn;
      expect(nextAvailable).toBeGreaterThan(0);
      expect(nextAvailable).toBeLessThanOrEqual(500);
    });
  });
});

describe('PerContractRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create limiter with default values', () => {
      const limiter = new PerContractRateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should create limiter with custom values', () => {
      const limiter = new PerContractRateLimiter(10, 5000);
      expect(limiter).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should allow requests within limit for same contract', async () => {
      const limiter = new PerContractRateLimiter(3, 1000);

      await limiter.acquire('AAPL:1m');
      await limiter.acquire('AAPL:1m');
      await limiter.acquire('AAPL:1m');
    });

    it('should track limits independently per contract', async () => {
      const limiter = new PerContractRateLimiter(2, 1000);

      await limiter.acquire('AAPL:1m');
      await limiter.acquire('AAPL:1m');

      await limiter.acquire('MSFT:1m');
      await limiter.acquire('MSFT:1m');
    });

    it('should block when contract limit is reached', async () => {
      const limiter = new PerContractRateLimiter(2, 1000);

      await limiter.acquire('AAPL:1m');
      await limiter.acquire('AAPL:1m');

      const acquirePromise = limiter.acquire('AAPL:1m');
      await vi.advanceTimersByTimeAsync(1100);
      await acquirePromise;
    });

    it('should not block other contracts when one is at limit', async () => {
      const limiter = new PerContractRateLimiter(1, 1000);

      await limiter.acquire('AAPL:1m');

      const msftPromise = limiter.acquire('MSFT:1m');
      await msftPromise;
    });
  });
});

describe('PacingViolationHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handleViolation', () => {
    it('should wait 15 seconds on first violation', async () => {
      const handler = new PacingViolationHandler();

      const handlePromise = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await handlePromise;

      expect(handler.shouldReduceRate()).toBe(false);
    });

    it('should increase backoff with multiple violations', async () => {
      const handler = new PacingViolationHandler();

      const violation1 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation1;

      const violation2 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation2;

      expect(handler.shouldReduceRate()).toBe(true);
    });

    it('should apply exponential backoff after max violations', async () => {
      const handler = new PacingViolationHandler();

      const processViolation = async () => {
        const violation = handler.handleViolation();
        await vi.advanceTimersByTimeAsync(15100);
        await violation;
      };

      await processViolation();
      await processViolation();

      const violation3 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(60100);
      await violation3;

      expect(handler.shouldReduceRate()).toBe(true);
    });
  });

  describe('shouldReduceRate', () => {
    it('should return false with no violations', () => {
      const handler = new PacingViolationHandler();
      expect(handler.shouldReduceRate()).toBe(false);
    });

    it('should return false with single violation', async () => {
      const handler = new PacingViolationHandler();

      const violation = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation;

      expect(handler.shouldReduceRate()).toBe(false);
    });

    it('should return true with multiple recent violations', async () => {
      const handler = new PacingViolationHandler();

      const violation1 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation1;

      const violation2 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation2;

      expect(handler.shouldReduceRate()).toBe(true);
    });

    it('should return false when violations are old', async () => {
      const handler = new PacingViolationHandler();

      const violation1 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation1;

      const violation2 = handler.handleViolation();
      await vi.advanceTimersByTimeAsync(15100);
      await violation2;

      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect(handler.shouldReduceRate()).toBe(false);
    });
  });
});
