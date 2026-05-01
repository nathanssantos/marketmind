/**
 * Smoke tests for the @marketmind/types dialog schemas (v1.6 E.7).
 *
 * Lives in the renderer for now since @marketmind/types has no
 * vitest infra and the renderer has the full setup. The tests stay
 * here even after schemas grow — they exercise the renderer-facing
 * usage pattern.
 */
import { describe, expect, it } from 'vitest';
import {
  createPaperWalletSchema,
  createRealWalletSchema,
  parseFormValues,
  screenerNameSchema,
  walletNameSchema,
  watcherSymbolSchema,
} from '@marketmind/types';

describe('dialog schemas', () => {
  describe('walletNameSchema', () => {
    it('accepts a normal name', () => {
      expect(walletNameSchema.safeParse('My Wallet').success).toBe(true);
    });
    it('rejects empty string', () => {
      expect(walletNameSchema.safeParse('').success).toBe(false);
    });
    it('rejects > 255 chars', () => {
      expect(walletNameSchema.safeParse('a'.repeat(256)).success).toBe(false);
    });
  });

  describe('createPaperWalletSchema', () => {
    it('parses with all defaults', () => {
      const r = createPaperWalletSchema.safeParse({ name: 'paper' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.currency).toBe('USDT');
        expect(r.data.marketType).toBe('FUTURES');
        expect(r.data.initialBalance).toBe('10000');
      }
    });
    it('rejects missing name', () => {
      expect(createPaperWalletSchema.safeParse({}).success).toBe(false);
    });
    it('rejects unknown currency', () => {
      expect(createPaperWalletSchema.safeParse({ name: 'p', currency: 'JPY' }).success).toBe(false);
    });
  });

  describe('createRealWalletSchema', () => {
    it('rejects missing apiKey', () => {
      expect(createRealWalletSchema.safeParse({ name: 'live', apiSecret: 's' }).success).toBe(false);
    });
    it('parses a complete payload', () => {
      const r = createRealWalletSchema.safeParse({
        name: 'live',
        apiKey: 'k',
        apiSecret: 's',
        walletType: 'live',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('screenerNameSchema', () => {
    it('rejects empty', () => {
      expect(screenerNameSchema.safeParse('').success).toBe(false);
    });
    it('accepts a short name', () => {
      expect(screenerNameSchema.safeParse('My filter').success).toBe(true);
    });
  });

  describe('watcherSymbolSchema', () => {
    it('accepts BTCUSDT', () => {
      expect(watcherSymbolSchema.safeParse('BTCUSDT').success).toBe(true);
    });
    it('rejects lowercase', () => {
      expect(watcherSymbolSchema.safeParse('btcusdt').success).toBe(false);
    });
    it('rejects symbol with hyphen', () => {
      expect(watcherSymbolSchema.safeParse('BTC-USDT').success).toBe(false);
    });
  });

  describe('parseFormValues helper', () => {
    it('returns valid + data on success', () => {
      const r = parseFormValues(walletNameSchema, 'ok');
      expect(r.valid).toBe(true);
      if (r.valid) expect(r.data).toBe('ok');
    });
    it('returns valid=false + first-error-per-field on failure', () => {
      const r = parseFormValues(createPaperWalletSchema, { name: '', currency: 'JPY' });
      expect(r.valid).toBe(false);
      if (!r.valid) {
        expect(r.errors.name).toBeDefined();
        expect(r.errors.currency).toBeDefined();
      }
    });
  });
});
