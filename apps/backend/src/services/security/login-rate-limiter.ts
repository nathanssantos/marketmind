import { TRPCError } from '@trpc/server';
import { logSecurityEvent, SecurityEvent } from './audit-logger';

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
};

const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  blockDurationMs: 24 * 60 * 60 * 1000,
};

const loginAttempts = new Map<string, RateLimitEntry>();
const registerAttempts = new Map<string, RateLimitEntry>();

const cleanupInterval = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts.entries()) {
      if (entry.blockedUntil && entry.blockedUntil < now) {
        loginAttempts.delete(key);
      } else if (now - entry.firstAttempt > LOGIN_RATE_LIMIT.windowMs) {
        loginAttempts.delete(key);
      }
    }
    for (const [key, entry] of registerAttempts.entries()) {
      if (entry.blockedUntil && entry.blockedUntil < now) {
        registerAttempts.delete(key);
      } else if (now - entry.firstAttempt > REGISTER_RATE_LIMIT.windowMs) {
        registerAttempts.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

cleanupInterval.unref();

const createKey = (ip: string, identifier: string): string => `${ip}:${identifier}`;

const checkRateLimit = (
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remainingAttempts: number; blockedUntil: number | null } => {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    return { allowed: true, remainingAttempts: config.maxAttempts, blockedUntil: null };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, remainingAttempts: 0, blockedUntil: entry.blockedUntil };
  }

  if (now - entry.firstAttempt > config.windowMs) {
    store.delete(key);
    return { allowed: true, remainingAttempts: config.maxAttempts, blockedUntil: null };
  }

  const remainingAttempts = config.maxAttempts - entry.attempts;
  return { allowed: remainingAttempts > 0, remainingAttempts, blockedUntil: null };
};

const recordAttempt = (
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig,
  success: boolean
): void => {
  const now = Date.now();
  const entry = store.get(key);

  if (success) {
    store.delete(key);
    return;
  }

  if (!entry || now - entry.firstAttempt > config.windowMs) {
    store.set(key, {
      attempts: 1,
      firstAttempt: now,
      blockedUntil: null,
    });
    return;
  }

  entry.attempts++;
  if (entry.attempts >= config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs;
  }
};

export const checkLoginRateLimit = (
  ip: string,
  email: string,
  metadata: { userAgent?: string } = {}
): void => {
  const key = createKey(ip, email.toLowerCase());
  const result = checkRateLimit(loginAttempts, key, LOGIN_RATE_LIMIT);

  if (!result.allowed) {
    logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
      ip,
      email,
      userAgent: metadata.userAgent,
      reason: 'login_attempts_exceeded',
      blockedUntil: result.blockedUntil
        ? new Date(result.blockedUntil).toISOString()
        : undefined,
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again later.',
    });
  }
};

export const recordLoginAttempt = (ip: string, email: string, success: boolean): void => {
  const key = createKey(ip, email.toLowerCase());
  recordAttempt(loginAttempts, key, LOGIN_RATE_LIMIT, success);
};

export const checkRegisterRateLimit = (
  ip: string,
  metadata: { userAgent?: string } = {}
): void => {
  const result = checkRateLimit(registerAttempts, ip, REGISTER_RATE_LIMIT);

  if (!result.allowed) {
    logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
      ip,
      userAgent: metadata.userAgent,
      reason: 'register_attempts_exceeded',
      blockedUntil: result.blockedUntil
        ? new Date(result.blockedUntil).toISOString()
        : undefined,
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many registration attempts. Please try again later.',
    });
  }
};

export const recordRegisterAttempt = (ip: string, success: boolean): void => {
  recordAttempt(registerAttempts, ip, REGISTER_RATE_LIMIT, success);
};

export const resetLoginAttempts = (ip: string, email: string): void => {
  const key = createKey(ip, email.toLowerCase());
  loginAttempts.delete(key);
};

export const resetRegisterAttempts = (ip: string): void => {
  registerAttempts.delete(ip);
};

export const getLoginAttemptsRemaining = (ip: string, email: string): number => {
  const key = createKey(ip, email.toLowerCase());
  const result = checkRateLimit(loginAttempts, key, LOGIN_RATE_LIMIT);
  return result.remainingAttempts;
};
