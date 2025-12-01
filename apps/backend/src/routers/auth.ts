import { verify } from '@node-rs/argon2';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../db/schema';
import { createSession, createUser, invalidateSession, validateSession } from '../services/auth';
import { publicProcedure, router } from '../trpc';

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

      ctx.res.setCookie('session', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      });

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

      ctx.res.setCookie('session', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      });

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

    ctx.res.clearCookie('session', { path: '/' });

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
