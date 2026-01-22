import { TRPCError } from '@trpc/server';
import { logger } from '../services/logger';

export const serializeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error === null || error === undefined) return 'Unknown error';
  if (typeof error === 'object') {
    const binanceError = error as { code?: number; msg?: string; message?: string };
    if (binanceError.msg) return `[${binanceError.code ?? 'ERR'}] ${binanceError.msg}`;
    if (binanceError.message) return binanceError.message;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
};

export const throwNotFound = (resource: string): never => {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: `${resource} not found`,
  });
};

export const throwBadRequest = (message: string): never => {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message,
  });
};

export const throwUnauthorized = (message = 'Unauthorized'): never => {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message,
  });
};

export const throwForbidden = (message = 'Forbidden'): never => {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message,
  });
};

export const throwConflict = (message: string): never => {
  throw new TRPCError({
    code: 'CONFLICT',
    message,
  });
};

export const throwInternalError = (message = 'Internal server error'): never => {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message,
  });
};

export const handleTRPCError = (
  error: unknown,
  context: Record<string, unknown> = {}
): never => {
  const errorMessage = serializeError(error);

  logger.error({ ...context, error: errorMessage }, 'Operation failed');

  if (error instanceof TRPCError) throw error;

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: errorMessage,
    cause: error,
  });
};

