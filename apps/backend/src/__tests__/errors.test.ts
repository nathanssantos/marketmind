import { describe, it, expect, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('../services/logger', () => ({
  logger: { error: vi.fn() },
}));

import {
  serializeError,
  throwNotFound,
  throwBadRequest,
  throwUnauthorized,
  throwForbidden,
  throwConflict,
  throwInternalError,
  handleTRPCError,
} from '../utils/errors';
import { logger } from '../services/logger';

describe('serializeError', () => {
  it('should serialize Error instances', () => {
    expect(serializeError(new Error('test error'))).toBe('test error');
  });

  it('should return string values as-is', () => {
    expect(serializeError('plain string error')).toBe('plain string error');
  });

  it('should return "Unknown error" for null', () => {
    expect(serializeError(null)).toBe('Unknown error');
  });

  it('should return "Unknown error" for undefined', () => {
    expect(serializeError(undefined)).toBe('Unknown error');
  });

  it('should serialize Binance-style errors with msg', () => {
    expect(serializeError({ code: -1021, msg: 'Timestamp outside of recvWindow' }))
      .toBe('[-1021] Timestamp outside of recvWindow');
  });

  it('should serialize Binance-style errors with msg but no code', () => {
    expect(serializeError({ msg: 'Some error' })).toBe('[ERR] Some error');
  });

  it('should serialize objects with message property', () => {
    expect(serializeError({ message: 'object message' })).toBe('object message');
  });

  it('should JSON.stringify objects without msg/message', () => {
    expect(serializeError({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('should handle objects that throw on JSON.stringify', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = serializeError(circular);
    expect(result).toBe('[object Object]');
  });

  it('should convert numbers to string', () => {
    expect(serializeError(42)).toBe('42');
  });

  it('should convert booleans to string', () => {
    expect(serializeError(false)).toBe('false');
  });
});

describe('throw helpers', () => {
  it('throwNotFound should throw TRPCError with NOT_FOUND code', () => {
    expect(() => throwNotFound('Wallet')).toThrow(TRPCError);
    try {
      throwNotFound('Wallet');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Wallet not found');
    }
  });

  it('throwBadRequest should throw TRPCError with BAD_REQUEST code', () => {
    try {
      throwBadRequest('Invalid input');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.message).toBe('Invalid input');
    }
  });

  it('throwUnauthorized should throw TRPCError with default message', () => {
    try {
      throwUnauthorized();
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Unauthorized');
    }
  });

  it('throwUnauthorized should throw TRPCError with custom message', () => {
    try {
      throwUnauthorized('Token expired');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Token expired');
    }
  });

  it('throwForbidden should throw TRPCError with default message', () => {
    try {
      throwForbidden();
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('Forbidden');
    }
  });

  it('throwForbidden should throw TRPCError with custom message', () => {
    try {
      throwForbidden('Access denied');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.message).toBe('Access denied');
    }
  });

  it('throwConflict should throw TRPCError with CONFLICT code', () => {
    try {
      throwConflict('Already exists');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('CONFLICT');
      expect(err.message).toBe('Already exists');
    }
  });

  it('throwInternalError should throw TRPCError with default message', () => {
    try {
      throwInternalError();
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.message).toBe('Internal server error');
    }
  });

  it('throwInternalError should throw TRPCError with custom message', () => {
    try {
      throwInternalError('DB connection failed');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.message).toBe('DB connection failed');
    }
  });
});

describe('handleTRPCError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should re-throw existing TRPCError as-is', () => {
    const originalError = new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });

    try {
      handleTRPCError(originalError);
    } catch (e) {
      const err = e as TRPCError;
      expect(err).toBe(originalError);
      expect(err.code).toBe('NOT_FOUND');
    }
  });

  it('should wrap non-TRPCError in INTERNAL_SERVER_ERROR', () => {
    const originalError = new Error('Something broke');

    try {
      handleTRPCError(originalError);
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.message).toBe('Something broke');
      expect(err.cause).toBe(originalError);
    }
  });

  it('should log error with context', () => {
    const context = { operation: 'createWallet', userId: '123' };

    try {
      handleTRPCError(new Error('fail'), context);
    } catch {
      // expected
    }

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'createWallet', userId: '123', error: 'fail' }),
      'Operation failed',
    );
  });

  it('should log error with empty context by default', () => {
    try {
      handleTRPCError('string error');
    } catch {
      // expected
    }

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'string error' }),
      'Operation failed',
    );
  });

  it('should handle string errors', () => {
    try {
      handleTRPCError('plain string error');
    } catch (e) {
      const err = e as TRPCError;
      expect(err.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.message).toBe('plain string error');
    }
  });
});
