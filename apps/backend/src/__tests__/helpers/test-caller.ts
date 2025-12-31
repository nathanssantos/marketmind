import { appRouter } from '../../trpc/router';
import type { Context } from '../../trpc/context';
import { createTestContext, createAuthenticatedContext, createUnauthenticatedContext } from './test-context';
import type { User, sessions } from '../../db/schema';

export type TestCaller = ReturnType<typeof appRouter.createCaller>;

export const createTestCaller = (ctx: Context): TestCaller => {
  return appRouter.createCaller(ctx);
};

export const createAuthenticatedCaller = (
  user: User,
  session: typeof sessions.$inferSelect
): TestCaller => {
  const ctx = createAuthenticatedContext(user, session);
  return createTestCaller(ctx);
};

export const createUnauthenticatedCaller = (): TestCaller => {
  const ctx = createUnauthenticatedContext();
  return createTestCaller(ctx);
};

export const createCallerWithContext = (
  options: Parameters<typeof createTestContext>[0] = {}
): { caller: TestCaller; ctx: Context } => {
  const ctx = createTestContext(options);
  const caller = createTestCaller(ctx);
  return { caller, ctx };
};
