import { analyticsRouter } from '../routers/analytics';
import { apiKeyRouter } from '../routers/api-keys';
import { authRouter } from '../routers/auth';
import { autoTradingRouter } from '../routers/auto-trading';
import { backtestRouter } from '../routers/backtest';
import { customSymbolRouter } from '../routers/custom-symbol';
import { drawingRouter } from '../routers/drawing';
import { layoutRouter } from '../routers/layout';
import { mcpRouter } from '../routers/mcp';
import { economicCalendarRouter } from '../routers/economic-calendar';
import { feesRouter } from '../routers/fees';
import { futuresTradingRouter } from '../routers/futures-trading/index';
import { healthRouter } from '../routers/health';
import { klineRouter } from '../routers/kline';
import { orderSyncRouter } from '../routers/order-sync';
import { preferencesRouter } from '../routers/preferences';
import { screenerRouter } from '../routers/screener';
import { setupRouter } from '../routers/setup';
import { setupDetectionRouter } from '../routers/setup-detection';
import { signalSuggestionsRouter } from '../routers/signal-suggestions';
import { tickerRouter } from '../routers/ticker';
import { tradingRouter } from '../routers/trading';
import { tradingProfilesRouter } from '../routers/trading-profiles';
import { userIndicatorsRouter } from '../routers/user-indicators';
import { userPatternsRouter } from '../routers/user-patterns';
import { walletRouter } from '../routers/wallet';
import { scalpingRouter } from '../routers/scalping';
import { heatmapRouter } from '../routers/heatmap';
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
  ticker: tickerRouter,
  apiKey: apiKeyRouter,
  orderSync: orderSyncRouter,
  preferences: preferencesRouter,
  screener: screenerRouter,
  customSymbol: customSymbolRouter,
  drawing: drawingRouter,
  layout: layoutRouter,
  mcp: mcpRouter,
  scalping: scalpingRouter,
  economicCalendar: economicCalendarRouter,
  heatmap: heatmapRouter,
  userIndicators: userIndicatorsRouter,
  userPatterns: userPatternsRouter,
});

export type AppRouter = typeof appRouter;
