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

const PASSWORD_RESET_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
};

const EMAIL_VERIFICATION_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
};

const TWO_FACTOR_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
};

const loginAttempts = new Map<string, RateLimitEntry>();
const registerAttempts = new Map<string, RateLimitEntry>();
const passwordResetAttempts = new Map<string, RateLimitEntry>();
const emailVerificationAttempts = new Map<string, RateLimitEntry>();
const twoFactorAttempts = new Map<string, RateLimitEntry>();

const cleanupStore = (store: Map<string, RateLimitEntry>, config: RateLimitConfig) => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if ((entry.blockedUntil && entry.blockedUntil < now) || now - entry.firstAttempt > config.windowMs) {
      store.delete(key);
    }
  }
};

const RATE_LIMIT_STORES: [Map<string, RateLimitEntry>, RateLimitConfig][] = [
  [loginAttempts, LOGIN_RATE_LIMIT],
  [registerAttempts, REGISTER_RATE_LIMIT],
  [passwordResetAttempts, PASSWORD_RESET_RATE_LIMIT],
  [emailVerificationAttempts, EMAIL_VERIFICATION_RATE_LIMIT],
  [twoFactorAttempts, TWO_FACTOR_RATE_LIMIT],
];

const cleanupInterval = setInterval(
  () => RATE_LIMIT_STORES.forEach(([store, config]) => cleanupStore(store, config)),
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

export const checkPasswordResetRateLimit = (
  email: string,
  metadata: { userAgent?: string; ip?: string } = {}
): void => {
  const key = email.toLowerCase();
  const result = checkRateLimit(passwordResetAttempts, key, PASSWORD_RESET_RATE_LIMIT);

  if (!result.allowed) {
    logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
      ...metadata,
      email,
      reason: 'password_reset_attempts_exceeded',
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many password reset attempts. Please try again later.',
    });
  }
};

export const recordPasswordResetAttempt = (email: string, success: boolean): void => {
  const key = email.toLowerCase();
  recordAttempt(passwordResetAttempts, key, PASSWORD_RESET_RATE_LIMIT, success);
};

export const checkEmailVerificationRateLimit = (
  email: string,
  metadata: { userAgent?: string; ip?: string } = {}
): void => {
  const key = email.toLowerCase();
  const result = checkRateLimit(emailVerificationAttempts, key, EMAIL_VERIFICATION_RATE_LIMIT);

  if (!result.allowed) {
    logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
      ...metadata,
      email,
      reason: 'email_verification_attempts_exceeded',
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification email requests. Please try again later.',
    });
  }
};

export const recordEmailVerificationAttempt = (email: string, success: boolean): void => {
  const key = email.toLowerCase();
  recordAttempt(emailVerificationAttempts, key, EMAIL_VERIFICATION_RATE_LIMIT, success);
};

export const checkTwoFactorRateLimit = (
  userId: string,
  metadata: { userAgent?: string; ip?: string } = {}
): void => {
  const result = checkRateLimit(twoFactorAttempts, userId, TWO_FACTOR_RATE_LIMIT);

  if (!result.allowed) {
    logSecurityEvent(SecurityEvent.RATE_LIMIT_EXCEEDED, null, {
      ...metadata,
      reason: 'two_factor_attempts_exceeded',
    });

    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many verification attempts. Please try again later.',
    });
  }
};

export const recordTwoFactorAttempt = (userId: string, success: boolean): void => {
  recordAttempt(twoFactorAttempts, userId, TWO_FACTOR_RATE_LIMIT, success);
};
