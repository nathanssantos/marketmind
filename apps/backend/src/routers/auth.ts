import { verify } from '@node-rs/argon2';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { validatePassword } from '@marketmind/utils';
import type { FastifyReply } from 'fastify';

const passwordPolicySchema = z.string().superRefine((value, ctx) => {
  const result = validatePassword(value);
  if (result.valid) return;
  ctx.addIssue({
    code: 'custom',
    message: `Password does not meet policy: ${result.issues.join(', ')}`,
    params: { issues: result.issues },
  });
});
import { sessions, users } from '../db/schema';
import {
  AVATAR_LIMITS,
  clearUserAvatar,
  createEmailVerificationToken,
  createPasswordResetToken,
  createSession,
  createTwoFactorCode,
  createUser,
  consumePasswordResetToken,
  getUserAvatar,
  invalidateAllUserSessions,
  invalidateOtherUserSessions,
  invalidateSession,
  listUserSessions,
  setUserAvatar,
  toggleTwoFactor,
  updateUserPassword,
  validatePasswordResetToken,
  validateSession,
  validateTwoFactorCode,
  verifyEmailToken,
  verifyPassword,
} from '../services/auth';
import { sendPasswordResetEmail, sendTwoFactorCode, sendVerificationEmail } from '../services/email';
import { seedDefaultTradingProfile, seedDefaultUserIndicators } from '../services/user-indicators';
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
        password: passwordPolicySchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req;
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
      await seedDefaultTradingProfile(userId);
      const { sessionId, expiresAt } = await createSession(userId, true, {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

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

      setSessionCookie(ctx.res, sessionId, expiresAt);

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
      const req = ctx.req;
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

      const { sessionId, expiresAt } = await createSession(user.id, input.rememberMe, {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, user.id, {
        ...metadata,
        email: input.email,
      });

      setSessionCookie(ctx.res, sessionId, expiresAt);

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
      const req = ctx.req;
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
      const { sessionId, expiresAt } = await createSession(input.userId, input.rememberMe, {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });

      logSecurityEvent(SecurityEvent.TWO_FACTOR_SUCCESS, input.userId, metadata);
      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, input.userId, metadata);

      setSessionCookie(ctx.res, sessionId, expiresAt);

      return { userId: input.userId, sessionId, expiresAt };
    }),

  resendTwoFactorCode: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req;
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

    const req = ctx.req;
    const metadata = extractRequestMetadata(req);
    const userId = ctx.user?.id ?? null;

    await invalidateSession(ctx.sessionId);

    logSecurityEvent(SecurityEvent.LOGOUT, userId, metadata);

    clearSessionCookie(ctx.res);

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
      avatarColor: result.user.avatarColor,
      hasAvatar: !!result.user.avatarData,
      createdAt: result.user.createdAt.toISOString(),
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().max(255).optional(),
      avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user;
      const updates: { name?: string | null; avatarColor?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) updates.name = input.name || null;
      if (input.avatarColor !== undefined) updates.avatarColor = input.avatarColor;

      await ctx.db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id));

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: passwordPolicySchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req;
      const metadata = extractRequestMetadata(req);
      const user = ctx.user;

      const valid = await verifyPassword(user.id, input.currentPassword);
      if (!valid) {
        logSecurityEvent(SecurityEvent.PASSWORD_RESET_FAILURE, user.id, {
          ...metadata,
          reason: 'invalid_current_password',
        });
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      await updateUserPassword(user.id, input.newPassword);
      if (ctx.sessionId) {
        await invalidateOtherUserSessions(user.id, ctx.sessionId);
      }

      logSecurityEvent(SecurityEvent.PASSWORD_RESET_SUCCESS, user.id, {
        ...metadata,
        reason: 'self_service_change',
      });

      return { success: true };
    }),

  uploadAvatar: protectedProcedure
    .input(z.object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!AVATAR_LIMITS.ALLOWED_MIME_TYPES.includes(input.mimeType as typeof AVATAR_LIMITS.ALLOWED_MIME_TYPES[number])) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported image type. Allowed: ${AVATAR_LIMITS.ALLOWED_MIME_TYPES.join(', ')}`,
        });
      }
      if (input.data.length > AVATAR_LIMITS.MAX_DATA_BYTES) {
        throw new TRPCError({
          code: 'PAYLOAD_TOO_LARGE',
          message: `Avatar exceeds maximum size of ${Math.round(AVATAR_LIMITS.MAX_DATA_BYTES / 1024)}KB`,
        });
      }

      await setUserAvatar(ctx.user.id, input.data, input.mimeType);
      return { success: true };
    }),

  deleteAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    await clearUserAvatar(ctx.user.id);
    return { success: true };
  }),

  getAvatar: protectedProcedure.query(async ({ ctx }) => {
    return await getUserAvatar(ctx.user.id);
  }),

  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listUserSessions(ctx.user.id);
    return rows.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      userAgent: s.userAgent,
      ip: s.ip,
      isCurrent: s.id === ctx.sessionId,
    }));
  }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (input.sessionId === ctx.sessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use logout to revoke the current session',
        });
      }
      await ctx.db
        .delete(sessions)
        .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, ctx.user.id)));
      return { success: true };
    }),

  revokeAllOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.sessionId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    await invalidateOtherUserSessions(ctx.user.id, ctx.sessionId);
    return { success: true };
  }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req;
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
        password: passwordPolicySchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req;
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
      const req = ctx.req;
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
    const req = ctx.req;
    const metadata = extractRequestMetadata(req);
    const user = ctx.user;

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
      const req = ctx.req;
      const metadata = extractRequestMetadata(req);
      const user = ctx.user;

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
