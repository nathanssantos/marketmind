import { TRPCError } from '@trpc/server';

/**
 * Centralized TRPCError factory. ~200 `throw new TRPCError(...)` sites
 * across the routers were producing inconsistent messages for the same
 * conditions ("wallet not found" / "Wallet not found" / "wallet does
 * not exist") and made it hard to add observability later. Routing
 * everything through these helpers keeps message shape stable and
 * gives us one place to attach error tracing / metrics if needed.
 *
 * Helpers throw rather than return so callers stay terse:
 *   if (!wallet) throw notFound('Wallet');
 *   if (qty <= 0) throw badRequest('quantity must be positive');
 */

export const notFound = (resource: string): TRPCError =>
  new TRPCError({ code: 'NOT_FOUND', message: `${resource} not found` });

export const badRequest = (reason: string): TRPCError =>
  new TRPCError({ code: 'BAD_REQUEST', message: reason });

export const conflict = (reason: string): TRPCError =>
  new TRPCError({ code: 'CONFLICT', message: reason });

export const unauthorized = (reason = 'Unauthorized'): TRPCError =>
  new TRPCError({ code: 'UNAUTHORIZED', message: reason });

export const forbidden = (reason = 'Forbidden'): TRPCError =>
  new TRPCError({ code: 'FORBIDDEN', message: reason });

export const internalServerError = (reason: string, cause?: unknown): TRPCError =>
  new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: reason, cause });
