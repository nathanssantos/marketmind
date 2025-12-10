import { hash, verify } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';

describe('Auth Service', () => {
  describe('Password Hashing', () => {
    const testPassword = 'TestPassword123!';

    it('should hash password with Argon2', async () => {
      const hashed = await hash(testPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(testPassword);
      expect(hashed.startsWith('$argon2')).toBe(true);
    });

    it('should verify correct password', async () => {
      const hashed = await hash(testPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      const isValid = await verify(hashed, testPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hashed = await hash(testPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      const isValid = await verify(hashed, 'WrongPassword123!');
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const hash1 = await hash(testPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      const hash2 = await hash(testPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      expect(hash1).not.toBe(hash2);
      expect(await verify(hash1, testPassword)).toBe(true);
      expect(await verify(hash2, testPassword)).toBe(true);
    });
  });

  describe('Session Token Generation', () => {
    it('should generate unique session tokens', () => {
      const token1 = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const token2 = Math.random().toString(36).substring(2) + Date.now().toString(36);

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(10);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
      ];

      validEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid@domain',
      ];

      invalidEmails.forEach((email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });
});
