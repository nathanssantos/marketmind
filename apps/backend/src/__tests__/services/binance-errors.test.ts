import { describe, expect, it } from 'vitest';
import {
  binanceErrorCode,
  binanceErrorText,
  isBenignMarginTypeError,
  isOrderNotFound,
  isTimestampError,
} from '../../services/binance-errors';

describe('binance-errors classifier', () => {
  describe('binanceErrorCode', () => {
    it('reads code off raw error, body, and cause', () => {
      expect(binanceErrorCode({ code: -2011 })).toBe(-2011);
      expect(binanceErrorCode({ body: { code: -1021 } })).toBe(-1021);
      expect(binanceErrorCode({ cause: { code: -4046 } })).toBe(-4046);
      expect(binanceErrorCode(new Error('no code'))).toBeUndefined();
      expect(binanceErrorCode(null)).toBeUndefined();
    });
  });

  describe('binanceErrorText', () => {
    it('combines message / msg / body.msg / cause, lowercased', () => {
      expect(binanceErrorText({ msg: 'Unknown Order sent.' })).toContain('unknown order');
      expect(binanceErrorText(new Error('Timestamp AHEAD of the server'))).toContain('ahead of the server');
      expect(binanceErrorText({ body: { msg: 'Order does not exist' } })).toContain('does not exist');
      expect(binanceErrorText('Plain String Error')).toBe('plain string error');
    });
  });

  describe('isTimestampError', () => {
    it('matches -1021 by code (raw + body) and by text', () => {
      expect(isTimestampError({ code: -1021 })).toBe(true);
      expect(isTimestampError({ body: { code: -1021 } })).toBe(true);
      expect(isTimestampError(new Error("Timestamp for this request was 1000ms ahead of the server's time."))).toBe(true);
      expect(isTimestampError({ msg: 'recvWindow exceeded' })).toBe(true);
      expect(isTimestampError({ code: -2011 })).toBe(false);
    });
  });

  describe('isOrderNotFound', () => {
    it('matches -2011 and every legacy string variant', () => {
      expect(isOrderNotFound({ code: -2011 })).toBe(true);
      expect(isOrderNotFound({ msg: 'Unknown order sent.' })).toBe(true);
      expect(isOrderNotFound(new Error('Order does not exist'))).toBe(true);
      expect(isOrderNotFound({ body: { msg: 'order not found' } })).toBe(true);
      expect(isOrderNotFound({ code: -1021 })).toBe(false);
      expect(isOrderNotFound(new Error('Insufficient balance'))).toBe(false);
    });
  });

  describe('isBenignMarginTypeError', () => {
    it('matches -4046 / -4067 and the benign messages', () => {
      expect(isBenignMarginTypeError({ code: -4046 })).toBe(true);
      expect(isBenignMarginTypeError({ code: -4067 })).toBe(true);
      expect(isBenignMarginTypeError({ msg: 'No need to change margin type.' })).toBe(true);
      expect(isBenignMarginTypeError(new Error('Margin type cannot be changed if there exists position'))).toBe(true);
      expect(isBenignMarginTypeError({ code: -2011 })).toBe(false);
    });
  });
});
