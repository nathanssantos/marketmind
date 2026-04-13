import type { Context } from '../../trpc/context';
import { getTestDatabase } from './test-db';
import type { User, sessions } from '../../db/schema';

export interface TestContextOptions {
  user?: User | null;
  session?: typeof sessions.$inferSelect | null;
  sessionId?: string;
}

export const createTestContext = (options: TestContextOptions = {}): Context => {
  const db = getTestDatabase();

  const mockRequest = {
    ip: '127.0.0.1',
    headers: {
      cookie: options.sessionId ? `session=${options.sessionId}` : undefined,
      'user-agent': 'test-agent',
    },
    cookies: {
      session: options.sessionId,
    },
  } as unknown as Context['req'];

  const mockResponse = {
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Context['res'];

  return {
    db: db as unknown as Context['db'],
    req: mockRequest,
    res: mockResponse,
    sessionId: options.sessionId ?? '',
    user: options.user ?? null,
    session: options.session ?? null,
    websocket: null,
  } as Context;
};

export const createAuthenticatedContext = (
  user: User,
  session: typeof sessions.$inferSelect
): Context => {
  return createTestContext({
    user,
    session,
    sessionId: session.id,
  });
};

export const createUnauthenticatedContext = (): Context => {
  return createTestContext({
    user: null,
    session: null,
    sessionId: undefined,
  });
};
