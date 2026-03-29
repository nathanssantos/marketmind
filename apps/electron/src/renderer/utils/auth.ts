import type { TRPCClientErrorLike } from '@trpc/client';
import type { AppRouter } from '@marketmind/backend';

type TRPCError = TRPCClientErrorLike<AppRouter> | null;

export const AUTH_UI = {
  FEEDBACK_TIMEOUT_MS: 3000,
  RESEND_TIMEOUT_MS: 5000,
  EMAIL_PLACEHOLDER: 'email@example.com',
  TWO_FACTOR_CODE_LENGTH: 6,
} as const;

export const isRateLimited = (error: TRPCError): boolean =>
  error?.data?.code === 'TOO_MANY_REQUESTS';

export const isConflict = (error: TRPCError): boolean =>
  error?.data?.code === 'CONFLICT';

export const isUnauthorized = (error: TRPCError): boolean =>
  error?.data?.code === 'UNAUTHORIZED';
