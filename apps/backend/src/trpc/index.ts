import { initTRPC, TRPCError } from '@trpc/server';
import { env } from '../env';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const demoOrProtectedProcedure = env.DEMO_MODE ? publicProcedure : protectedProcedure;
