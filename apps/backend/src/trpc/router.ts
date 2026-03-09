import { analyticsRouter } from '../routers/analytics';
import { apiKeyRouter } from '../routers/api-keys';
import { authRouter } from '../routers/auth';
import { autoTradingRouter } from '../routers/auto-trading';
import { backtestRouter } from '../routers/backtest';
import { customSymbolRouter } from '../routers/custom-symbol';
import { feesRouter } from '../routers/fees';
import { futuresTradingRouter } from '../routers/futures-trading';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { orderSyncRouter } from '../routers/order-sync';
import { preferencesRouter } from '../routers/preferences';
import { screenerRouter } from '../routers/screener';
import { setupRouter } from '../routers/setup';
import { setupDetectionRouter } from '../routers/setup-detection';
import { signalSuggestionsRouter } from '../routers/signal-suggestions';
import { tradingRouter } from '../routers/trading';
import { tradingProfilesRouter } from '../routers/trading-profiles';
import { walletRouter } from '../routers/wallet';
import { nestedTradingRouter } from '../routers/trading/index';
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
  signalSuggestions: signalSuggestionsRouter,
  apiKey: apiKeyRouter,
  orderSync: orderSyncRouter,
  trade: nestedTradingRouter,
  preferences: preferencesRouter,
  screener: screenerRouter,
  customSymbol: customSymbolRouter,
});

export type AppRouter = typeof appRouter;
