import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.31.0',
  })),

  ping: publicProcedure
    .input(z.object({ message: z.string().optional() }))
    .query(({ input }) => ({
      pong: true,
      echo: input.message || 'No message provided',
    })),
});
