import { verify } from '@node-rs/argon2';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { users } from '../db/schema';
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  createSession,
  createTwoFactorCode,
  createUser,
  consumePasswordResetToken,
  invalidateAllUserSessions,
  invalidateSession,
  toggleTwoFactor,
  updateUserPassword,
  validatePasswordResetToken,
  validateSession,
  validateTwoFactorCode,
  verifyEmailToken,
} from '../services/auth';
import { sendPasswordResetEmail, sendTwoFactorCode, sendVerificationEmail } from '../services/email';
import { seedDefaultUserIndicators } from '../services/user-indicators';
import {
  checkEmailVerificationRateLimit,
  checkLoginRateLimit,
  checkPasswordResetRateLimit,
  checkRegisterRateLimit,
  checkTwoFactorRateLimit,
  extractRequestMetadata,
  logSecurityEvent,
  recordEmailVerificationAttempt,
  recordLoginAttempt,
  recordPasswordResetAttempt,
  recordRegisterAttempt,
  recordTwoFactorAttempt,
  SecurityEvent,
} from '../services/security';
import { protectedProcedure, publicProcedure, router } from '../trpc';

interface CookieReply {
  setCookie(name: string, value: string, options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
    expires: Date;
    path: string;
  }): void;
  clearCookie(name: string, options: { path: string }): void;
}

const setSessionCookie = (res: FastifyReply, sessionId: string, expiresAt: Date): void => {
  (res as unknown as CookieReply).setCookie('session', sessionId, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
};

const clearSessionCookie = (res: FastifyReply): void => {
  (res as unknown as CookieReply).clearCookie('session', { path: '/' });
};

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const ip = req.ip ?? 'unknown';
      const metadata = extractRequestMetadata(req);

      checkRegisterRateLimit(ip, metadata);

      const [existingUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser) {
        recordRegisterAttempt(ip, false);
        logSecurityEvent(SecurityEvent.REGISTER_FAILURE, null, {
          ...metadata,
          email: input.email,
          reason: 'email_already_registered',
        });
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already registered',
        });
      }

      const userId = await createUser(input.email, input.password);
      await seedDefaultUserIndicators(userId);
      const { sessionId, expiresAt } = await createSession(userId);

      const verificationToken = await createEmailVerificationToken(userId);
      await sendVerificationEmail(input.email, verificationToken);

      recordRegisterAttempt(ip, true);
      logSecurityEvent(SecurityEvent.REGISTER_SUCCESS, userId, {
        ...metadata,
        email: input.email,
      });
      logSecurityEvent(SecurityEvent.EMAIL_VERIFICATION_SENT, userId, {
        ...metadata,
        email: input.email,
      });

      setSessionCookie(ctx.res as FastifyReply, sessionId, expiresAt);

      return {
        userId,
        sessionId,
        expiresAt,
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const ip = req.ip ?? 'unknown';
      const metadata = extractRequestMetadata(req);

      checkLoginRateLimit(ip, input.email, metadata);

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        recordLoginAttempt(ip, input.email, false);
        logSecurityEvent(SecurityEvent.LOGIN_FAILURE, null, {
          ...metadata,
          email: input.email,
          reason: 'user_not_found',
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      const validPassword = await verify(user.passwordHash, input.password);

      if (!validPassword) {
        recordLoginAttempt(ip, input.email, false);
        logSecurityEvent(SecurityEvent.LOGIN_FAILURE, user.id, {
          ...metadata,
          email: input.email,
          reason: 'invalid_password',
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      recordLoginAttempt(ip, input.email, true);

      if (user.twoFactorEnabled) {
        const code = await createTwoFactorCode(user.id);
        await sendTwoFactorCode(user.email, code);

        logSecurityEvent(SecurityEvent.TWO_FACTOR_SENT, user.id, {
          ...metadata,
          email: input.email,
        });

        return {
          requiresTwoFactor: true as const,
          userId: user.id,
        };
      }

      const { sessionId, expiresAt } = await createSession(user.id, input.rememberMe);

      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, user.id, {
        ...metadata,
        email: input.email,
      });

      setSessionCookie(ctx.res as FastifyReply, sessionId, expiresAt);

      return {
        requiresTwoFactor: false as const,
        userId: user.id,
        sessionId,
        expiresAt,
      };
    }),

  verifyTwoFactor: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        code: z.string().length(6),
        rememberMe: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);

      checkTwoFactorRateLimit(input.userId, metadata);

      const valid = await validateTwoFactorCode(input.userId, input.code);

      if (!valid) {
        recordTwoFactorAttempt(input.userId, false);
        logSecurityEvent(SecurityEvent.TWO_FACTOR_FAILURE, input.userId, {
          ...metadata,
          reason: 'invalid_code',
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired code',
        });
      }

      recordTwoFactorAttempt(input.userId, true);
      const { sessionId, expiresAt } = await createSession(input.userId, input.rememberMe);

      logSecurityEvent(SecurityEvent.TWO_FACTOR_SUCCESS, input.userId, metadata);
      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, input.userId, metadata);

      setSessionCookie(ctx.res as FastifyReply, sessionId, expiresAt);

      return { userId: input.userId, sessionId, expiresAt };
    }),

  resendTwoFactorCode: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);

      checkTwoFactorRateLimit(input.userId, metadata);

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const code = await createTwoFactorCode(user.id);
      await sendTwoFactorCode(user.email, code);

      logSecurityEvent(SecurityEvent.TWO_FACTOR_SENT, user.id, metadata);

      return { success: true };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.sessionId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const req = ctx.req as FastifyRequest;
    const metadata = extractRequestMetadata(req);
    const userId = ctx.user?.id ?? null;

    await invalidateSession(ctx.sessionId);

    logSecurityEvent(SecurityEvent.LOGOUT, userId, metadata);

    clearSessionCookie(ctx.res as FastifyReply);

    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionId) return null;

    const result = await validateSession(ctx.sessionId);
    if (!result) return null;

    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      emailVerified: result.user.emailVerified,
      twoFactorEnabled: result.user.twoFactorEnabled,
      createdAt: result.user.createdAt.toISOString(),
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().max(255).optional() }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user!;
      await ctx.db
        .update(users)
        .set({ name: input.name ?? null, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      return { success: true };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);

      checkPasswordResetRateLimit(input.email, metadata);

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (user) {
        const token = await createPasswordResetToken(user.id);
        await sendPasswordResetEmail(user.email, token);
        recordPasswordResetAttempt(input.email, true);
        logSecurityEvent(SecurityEvent.PASSWORD_RESET_REQUEST, user.id, {
          ...metadata,
          email: input.email,
        });
      } else {
        recordPasswordResetAttempt(input.email, false);
      }

      return { success: true };
    }),

  validateResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const result = await validatePasswordResetToken(input.token);
      return { valid: !!result };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);

      const tokenResult = await validatePasswordResetToken(input.token);

      if (!tokenResult) {
        logSecurityEvent(SecurityEvent.PASSWORD_RESET_FAILURE, null, {
          ...metadata,
          reason: 'invalid_or_expired_token',
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token',
        });
      }

      await updateUserPassword(tokenResult.userId, input.password);
      await consumePasswordResetToken(input.token);
      await invalidateAllUserSessions(tokenResult.userId);

      logSecurityEvent(SecurityEvent.PASSWORD_RESET_SUCCESS, tokenResult.userId, metadata);

      return { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);

      const result = await verifyEmailToken(input.token);

      if (!result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification link',
        });
      }

      logSecurityEvent(SecurityEvent.EMAIL_VERIFICATION_SUCCESS, result.userId, metadata);

      return { success: true };
    }),

  resendVerificationEmail: protectedProcedure.mutation(async ({ ctx }) => {
    const req = ctx.req as FastifyRequest;
    const metadata = extractRequestMetadata(req);
    const user = ctx.user!;

    if (user.emailVerified) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Email already verified',
      });
    }

    checkEmailVerificationRateLimit(user.email, metadata);

    const token = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, token);

    recordEmailVerificationAttempt(user.email, true);
    logSecurityEvent(SecurityEvent.EMAIL_VERIFICATION_SENT, user.id, {
      ...metadata,
      email: user.email,
    });

    return { success: true };
  }),

  toggleTwoFactor: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req as FastifyRequest;
      const metadata = extractRequestMetadata(req);
      const user = ctx.user!;

      if (input.enabled && !user.emailVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email must be verified before enabling two-factor authentication',
        });
      }

      await toggleTwoFactor(user.id, input.enabled);

      logSecurityEvent(SecurityEvent.TWO_FACTOR_TOGGLED, user.id, {
        ...metadata,
        reason: input.enabled ? 'enabled' : 'disabled',
      });

      return { success: true, enabled: input.enabled };
    }),
});
