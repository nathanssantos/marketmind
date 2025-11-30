import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { db } from '../db/client';
import { validateSession } from '../services/auth';

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const sessionId = req.cookies.session_id;

  if (!sessionId) {
    return {
      db,
      sessionId: undefined,
      user: null,
      session: null,
    };
  }

  const result = await validateSession(sessionId);

  return {
    db,
    sessionId,
    user: result?.user || null,
    session: result?.session || null,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
