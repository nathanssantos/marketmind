import { authRouter } from '../routers/auth';
import { backtestRouter } from '../routers/backtest';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { setupRouter } from '../routers/setup';
import { tradingRouter } from '../routers/trading';
import { walletRouter } from '../routers/wallet';
import { router } from '../trpc';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  wallet: walletRouter,
  trading: tradingRouter,
  kline: klineRouter,
  setup: setupRouter,
  backtest: backtestRouter,
});

export type AppRouter = typeof appRouter;
