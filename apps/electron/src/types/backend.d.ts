declare module '@backend/types' {
  import type { AppRouter as BackendRouter } from '../../../../backend/src/trpc/router';
  export type AppRouter = BackendRouter;
}
