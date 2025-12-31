import { TRPCError } from '@trpc/server';

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
