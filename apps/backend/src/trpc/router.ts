import { aiTradingRouter } from '../routers/ai-trading';
import { analyticsRouter } from '../routers/analytics';
import { apiKeyRouter } from '../routers/api-keys';
import { authRouter } from '../routers/auth';
import { autoTradingRouter } from '../routers/auto-trading';
import { backtestRouter } from '../routers/backtest';
import { feesRouter } from '../routers/fees';
import { futuresTradingRouter } from '../routers/futures-trading';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { marketContextRouter } from '../routers/market-context';
import { mlRouter } from '../routers/ml';
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
  aiTrading: aiTradingRouter,
  analytics: analyticsRouter,
  fees: feesRouter,
  kline: klineRouter,
  setup: setupRouter,
  setupDetection: setupDetectionRouter,
  backtest: backtestRouter,
  ml: mlRouter,
  marketContext: marketContextRouter,
  tradingProfiles: tradingProfilesRouter,
  apiKey: apiKeyRouter,
});

export type AppRouter = typeof appRouter;
