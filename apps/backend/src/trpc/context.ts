import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { db } from '../db/client';
import { validateSession } from '../services/auth';
import type { WebSocketService } from '../services/websocket';

let websocketService: WebSocketService | null = null;

export const setWebSocketService = (ws: WebSocketService) => {
  websocketService = ws;
};

export const createContext = async ({ req, res }: CreateFastifyContextOptions) => {
  const sessionId = req.headers.cookie?.split(';').find(c => c.trim().startsWith('session='))?.split('=')[1];

  if (!sessionId) {
    return {
      db,
      req,
      res,
      sessionId: undefined,
      user: null,
      session: null,
      websocket: websocketService,
    };
  }

  const result = await validateSession(sessionId);

  return {
    db,
    req,
    res,
    sessionId,
    user: result?.user || null,
    session: result?.session || null,
    websocket: websocketService,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
