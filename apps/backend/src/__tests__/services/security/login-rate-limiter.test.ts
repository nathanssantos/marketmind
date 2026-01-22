import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  checkRegisterRateLimit,
  recordRegisterAttempt,
  resetLoginAttempts,
  resetRegisterAttempts,
  getLoginAttemptsRemaining,
} from '../../../services/security/login-rate-limiter';
import { TRPCError } from '@trpc/server';

vi.mock('../../../services/security/audit-logger', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEvent: {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
}));

describe('Login Rate Limiter', () => {
  const testIp = '192.168.1.100';
  const testEmail = 'test@example.com';

  beforeEach(() => {
    resetLoginAttempts(testIp, testEmail);
    resetLoginAttempts('192.168.1.101', 'other@example.com');
    resetRegisterAttempts(testIp);
    resetRegisterAttempts('192.168.1.101');
    resetRegisterAttempts('new-ip');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkLoginRateLimit', () => {
    it('should allow first login attempt', () => {
      expect(() => checkLoginRateLimit(testIp, testEmail)).not.toThrow();
    });

    it('should allow up to 5 failed attempts', () => {
      for (let i = 0; i < 4; i++) {
        checkLoginRateLimit(testIp, testEmail);
        recordLoginAttempt(testIp, testEmail, false);
      }

      expect(() => checkLoginRateLimit(testIp, testEmail)).not.toThrow();
    });

    it('should block after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(testIp, testEmail);
        recordLoginAttempt(testIp, testEmail, false);
      }

      expect(() => checkLoginRateLimit(testIp, testEmail)).toThrow(TRPCError);
    });

    it('should throw TRPCError with TOO_MANY_REQUESTS code', () => {
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(testIp, testEmail);
        recordLoginAttempt(testIp, testEmail, false);
      }

      try {
        checkLoginRateLimit(testIp, testEmail);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('TOO_MANY_REQUESTS');
      }
    });

    it('should track attempts separately per IP+email combination', () => {
      for (let i = 0; i < 4; i++) {
        recordLoginAttempt(testIp, testEmail, false);
      }

      expect(() =>
        checkLoginRateLimit('192.168.1.101', testEmail)
      ).not.toThrow();
      expect(() =>
        checkLoginRateLimit(testIp, 'other@example.com')
      ).not.toThrow();
    });

    it('should be case-insensitive for email', () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(testIp, 'Test@Example.com', false);
      }

      expect(() =>
        checkLoginRateLimit(testIp, 'test@example.com')
      ).toThrow(TRPCError);
    });
  });

  describe('recordLoginAttempt', () => {
    it('should clear attempts on successful login', () => {
      for (let i = 0; i < 4; i++) {
        recordLoginAttempt(testIp, testEmail, false);
      }

      recordLoginAttempt(testIp, testEmail, true);

      const remaining = getLoginAttemptsRemaining(testIp, testEmail);
      expect(remaining).toBe(5);
    });

    it('should increment counter on failed attempt', () => {
      recordLoginAttempt(testIp, testEmail, false);

      const remaining = getLoginAttemptsRemaining(testIp, testEmail);
      expect(remaining).toBe(4);
    });
  });

  describe('getLoginAttemptsRemaining', () => {
    it('should return 5 for new IP+email combination', () => {
      const remaining = getLoginAttemptsRemaining('new-ip', 'new@email.com');
      expect(remaining).toBe(5);
    });

    it('should decrease as attempts are made', () => {
      recordLoginAttempt(testIp, testEmail, false);
      expect(getLoginAttemptsRemaining(testIp, testEmail)).toBe(4);

      recordLoginAttempt(testIp, testEmail, false);
      expect(getLoginAttemptsRemaining(testIp, testEmail)).toBe(3);

      recordLoginAttempt(testIp, testEmail, false);
      expect(getLoginAttemptsRemaining(testIp, testEmail)).toBe(2);
    });

    it('should return 0 when blocked', () => {
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(testIp, testEmail, false);
      }

      const remaining = getLoginAttemptsRemaining(testIp, testEmail);
      expect(remaining).toBe(0);
    });
  });

  describe('resetLoginAttempts', () => {
    it('should reset attempts for specific IP+email', () => {
      for (let i = 0; i < 4; i++) {
        recordLoginAttempt(testIp, testEmail, false);
      }

      resetLoginAttempts(testIp, testEmail);

      const remaining = getLoginAttemptsRemaining(testIp, testEmail);
      expect(remaining).toBe(5);
    });

    it('should not affect other IP+email combinations', () => {
      const otherIp = '192.168.1.101';
      const otherEmail = 'other@example.com';

      for (let i = 0; i < 3; i++) {
        recordLoginAttempt(testIp, testEmail, false);
        recordLoginAttempt(otherIp, otherEmail, false);
      }

      resetLoginAttempts(testIp, testEmail);

      expect(getLoginAttemptsRemaining(testIp, testEmail)).toBe(5);
      expect(getLoginAttemptsRemaining(otherIp, otherEmail)).toBe(2);
    });
  });

  describe('checkRegisterRateLimit', () => {
    it('should allow first registration attempt', () => {
      expect(() => checkRegisterRateLimit('new-ip')).not.toThrow();
    });

    it('should allow up to 3 registration attempts', () => {
      for (let i = 0; i < 2; i++) {
        checkRegisterRateLimit(testIp);
        recordRegisterAttempt(testIp, false);
      }

      expect(() => checkRegisterRateLimit(testIp)).not.toThrow();
    });

    it('should block after 3 failed registration attempts', () => {
      for (let i = 0; i < 3; i++) {
        checkRegisterRateLimit(testIp);
        recordRegisterAttempt(testIp, false);
      }

      expect(() => checkRegisterRateLimit(testIp)).toThrow(TRPCError);
    });

    it('should track attempts per IP only', () => {
      for (let i = 0; i < 2; i++) {
        recordRegisterAttempt(testIp, false);
      }

      expect(() => checkRegisterRateLimit('192.168.1.101')).not.toThrow();
    });
  });

  describe('recordRegisterAttempt', () => {
    it('should clear attempts on successful registration', () => {
      for (let i = 0; i < 2; i++) {
        recordRegisterAttempt(testIp, false);
      }

      recordRegisterAttempt(testIp, true);

      expect(() => checkRegisterRateLimit(testIp)).not.toThrow();
    });
  });
});
