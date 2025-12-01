import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Validation Schemas', () => {
  describe('User Registration Schema', () => {
    const registerSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    it('should validate correct registration data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'SecurePass123!',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'short',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Wallet Creation Schema', () => {
    const walletSchema = z.object({
      name: z.string().min(1),
      exchange: z.enum(['binance', 'bybit']),
      apiKey: z.string().min(1),
      apiSecret: z.string().min(1),
    });

    it('should validate correct wallet data', () => {
      const validData = {
        name: 'My Binance Wallet',
        exchange: 'binance' as const,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const result = walletSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid exchange', () => {
      const invalidData = {
        name: 'My Wallet',
        exchange: 'unknown',
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const result = walletSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        exchange: 'binance' as const,
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
      };

      const result = walletSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
