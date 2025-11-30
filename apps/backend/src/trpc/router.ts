import { authRouter } from '../routers/auth';
import { healthRouter } from '../routers/health';
import { tradingRouter } from '../routers/trading';
import { walletRouter } from '../routers/wallet';
import { router } from '../trpc';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  wallet: walletRouter,
  trading: tradingRouter,
});

export type AppRouter = typeof appRouter;
