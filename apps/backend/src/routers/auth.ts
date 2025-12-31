import { verify } from '@node-rs/argon2';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import { users } from '../db/schema';
import { createSession, createUser, invalidateSession, validateSession } from '../services/auth';
import { publicProcedure, router } from '../trpc';

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
      const [existingUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already registered',
        });
      }

      const userId = await createUser(input.email, input.password);
      const { sessionId, expiresAt } = await createSession(userId);

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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      const validPassword = await verify(user.passwordHash, input.password);

      if (!validPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      const { sessionId, expiresAt } = await createSession(user.id);

      setSessionCookie(ctx.res as FastifyReply, sessionId, expiresAt);

      return {
        userId: user.id,
        sessionId,
        expiresAt,
      };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.sessionId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    await invalidateSession(ctx.sessionId);

    clearSessionCookie(ctx.res as FastifyReply);

    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionId) {
      return null;
    }

    const result = await validateSession(ctx.sessionId);

    if (!result) {
      return null;
    }

    return {
      id: result.user.id,
      email: result.user.email,
    };
  }),
});
