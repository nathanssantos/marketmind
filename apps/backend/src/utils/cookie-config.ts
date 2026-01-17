import { env } from '../env';

export const SESSION_COOKIE_NAME = 'session';

export const getSessionCookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  expires: expiresAt,
  path: '/',
});

export const CLEAR_COOKIE_OPTIONS = {
  path: '/',
};
