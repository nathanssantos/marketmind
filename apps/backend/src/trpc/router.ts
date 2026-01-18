import { analyticsRouter } from '../routers/analytics';
import { apiKeyRouter } from '../routers/api-keys';
import { authRouter } from '../routers/auth';
import { autoTradingRouter } from '../routers/auto-trading';
import { backtestRouter } from '../routers/backtest';
import { feesRouter } from '../routers/fees';
import { futuresTradingRouter } from '../routers/futures-trading';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { orderSyncRouter } from '../routers/order-sync';
import { setupRouter } from '../routers/setup';
import { setupDetectionRouter } from '../routers/setup-detection';
import { tradingRouter } from '../routers/trading';
import { tradingProfilesRouter } from '../routers/trading-profiles';
import { walletRouter } from '../routers/wallet';
import { router } from '../trpc';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  wallet: walletRouter,
  trading: tradingRouter,
  futuresTrading: futuresTradingRouter,
  autoTrading: autoTradingRouter,
  analytics: analyticsRouter,
  fees: feesRouter,
  kline: klineRouter,
  setup: setupRouter,
  setupDetection: setupDetectionRouter,
  backtest: backtestRouter,
  tradingProfiles: tradingProfilesRouter,
  apiKey: apiKeyRouter,
  orderSync: orderSyncRouter,
});

export type AppRouter = typeof appRouter;
