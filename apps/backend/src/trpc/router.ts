import { analyticsRouter } from '../routers/analytics';
import { authRouter } from '../routers/auth';
import { autoTradingRouter } from '../routers/auto-trading';
import { backtestRouter } from '../routers/backtest';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { setupRouter } from '../routers/setup';
import { setupDetectionRouter } from '../routers/setup-detection';
import { tradingRouter } from '../routers/trading';
import { walletRouter } from '../routers/wallet';
import { router } from '../trpc';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  wallet: walletRouter,
  trading: tradingRouter,
  autoTrading: autoTradingRouter,
  analytics: analyticsRouter,
  kline: klineRouter,
  setup: setupRouter,
  setupDetection: setupDetectionRouter,
  backtest: backtestRouter,
});

export type AppRouter = typeof appRouter;
