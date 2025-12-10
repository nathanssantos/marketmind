declare module '@marketmind/backend' {
  import type { appRouter } from '../../../backend/src/trpc/router';
  export type AppRouter = typeof appRouter;
}
