import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { STARTUP_CONFIG } from './constants';
import { db } from './db/client';
import { env } from './env';
import { initializeWebSocket } from './services/websocket';
import { createContext, setWebSocketService } from './trpc/context';
import { appRouter } from './trpc/router';

const fastify = Fastify({
  logger: {
    level: 'warn',
  },
  routerOptions: {
    maxParamLength: 5000,
  },
});

const start = async (): Promise<void> => {
  try {
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: env.NODE_ENV === 'production',
    });

    await fastify.register(rateLimit, {
      max: parseInt(process.env['RATE_LIMIT_MAX'] ?? '1000', 10),
      timeWindow: parseInt(process.env['RATE_LIMIT_WINDOW'] ?? '60000', 10),
      allowList: env.NODE_ENV === 'development' ? ['127.0.0.1', '::1', '::ffff:127.0.0.1'] : [],
      errorResponseBuilder: (request, context) => {
        const message = `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s.`;
        if (request.url.startsWith('/trpc/')) {
          return {
            error: {
              json: {
                message,
                code: -32004,
                data: { code: 'TOO_MANY_REQUESTS', httpStatus: 429 },
              },
            },
          };
        }
        return { statusCode: 429, error: 'Too Many Requests', message };
      },
    });

    await fastify.register(cors, {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        
        if (env.NODE_ENV === 'development') {
          const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
          callback(null, isLocalhost);
        } else {
          callback(null, origin === env.CORS_ORIGIN);
        }
      },
      credentials: true,
    });

    await fastify.register(cookie, {
      secret: env.SESSION_SECRET,
    });

    await fastify.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: appRouter,
        createContext,
        onError({ path, error }: { path?: string; error: unknown }) {
          const code = (error as { code?: string } | null)?.code;
          // 4xx-equivalent codes are normal client-flow events (session expired,
          // input validation, missing resource) — not server errors. Log at debug
          // so they don't pollute prod error feeds. 5xx and unknown codes stay
          // at error level so real bugs are still surfaced.
          const is4xx =
            code === 'UNAUTHORIZED' ||
            code === 'FORBIDDEN' ||
            code === 'NOT_FOUND' ||
            code === 'BAD_REQUEST' ||
            code === 'CONFLICT' ||
            code === 'PRECONDITION_FAILED' ||
            code === 'PAYLOAD_TOO_LARGE' ||
            code === 'METHOD_NOT_SUPPORTED' ||
            code === 'TIMEOUT' ||
            code === 'UNPROCESSABLE_CONTENT' ||
            code === 'TOO_MANY_REQUESTS' ||
            code === 'CLIENT_CLOSED_REQUEST';
          // Network-outage fast-fails are infrastructural (DNS / interface
          // down between renderer poll and exchange) — logging the full
          // axios stack on each retry just floods the feed. Demote to debug.
          const isOutage = code === 'SERVICE_UNAVAILABLE';
          if (is4xx || isOutage) {
            fastify.log.debug({ path, code }, 'tRPC client error');
          } else {
            fastify.log.error({ path, error }, 'tRPC error');
          }
        },
      },
    });

    fastify.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.31.0',
    }));

    fastify.get('/ready', async () => ({
      ready: true,
      timestamp: new Date().toISOString(),
    }));

    fastify.get('/', async () => ({
      name: 'MarketMind API',
      version: process.env['npm_package_version'] ?? '0.31.0',
      endpoints: {
        health: '/health',
        ready: '/ready',
        trpc: '/trpc',
      },
    }));

    // Custom symbol service must be loaded BEFORE we start accepting
    // tRPC requests. Otherwise the renderer connecting on `fastify.listen`
    // can fire kline queries for composite symbols (POLITIFI etc.) before
    // `customSymbolSet` is populated — `isCustomSymbolSync` returns false,
    // kline-prefetch falls through to direct Binance API and 400's because
    // the symbol doesn't exist on the exchange. Demo mode skips this since
    // it doesn't start trading services at all.
    if (!env.DEMO_MODE) {
      const { startCustomSymbolService } = await import('./services/custom-symbol-service');
      await startCustomSymbolService();
      fastify.log.info('> Custom symbol service started');
    }

    const port = parseInt(env.PORT, 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    const websocketService = initializeWebSocket(fastify.server);
    setWebSocketService(websocketService);

    const [
      { binancePriceStreamService },
      { binanceKlineStreamService, binanceFuturesKlineStreamService },
    ] = await Promise.all([
      import('./services/binance-price-stream'),
      import('./services/binance-kline-stream'),
    ]);

    binancePriceStreamService.start();
    binanceKlineStreamService.start();
    binanceFuturesKlineStreamService.start();

    if (env.DEMO_MODE) {
      // Kline maintenance scheduler disabled — was a workaround for chart
      // candle corruption that turned out to be a frontend rendering issue
      // (backgroundThrottling + stale canvas snapshot). With those fixed,
      // the periodic gap/corruption sweep is no longer needed. Manual
      // repair via Settings → Data still works through the tRPC route.

      fastify.log.info(`> Backend server running on http://localhost:${port} [DEMO MODE]`);
      fastify.log.info(`> tRPC endpoint: http://localhost:${port}/trpc`);
      fastify.log.info(`> WebSocket server initialized`);
      fastify.log.info(`> Binance price stream service started`);
      fastify.log.info(`> Binance kline stream service started (SPOT + FUTURES)`);
      fastify.log.info(`> Trading services SKIPPED (demo mode)`);
    } else {
      const [
        { positionMonitorService },
        { binanceUserStreamService },
        { binanceFuturesUserStreamService },
        { positionSyncService },
      ] = await Promise.all([
        import('./services/position-monitor'),
        import('./services/binance-user-stream'),
        import('./services/binance-futures-user-stream'),
        import('./services/position-sync'),
      ]);

      positionMonitorService.start();

      await Promise.all([
        binanceUserStreamService.start(),
        binanceFuturesUserStreamService.start(),
        positionSyncService.start(),
      ]);

      const { autoTradingScheduler } = await import('./services/auto-trading-scheduler');
      await autoTradingScheduler.restoreWatchersFromDb();

      const { cooldownService } = await import('./services/cooldown');
      cooldownService.startCleanupScheduler(60);

      const { startCleanupScheduler } = await import('./services/cleanup');
      startCleanupScheduler();

      const { fundingRateService } = await import('./services/funding-rate-service');
      fundingRateService.start();

      // Kline maintenance scheduler disabled — see DEMO_MODE branch above.

      const { orderSyncService } = await import('./services/order-sync');
      await orderSyncService.start({ autoCancelOrphans: false, autoFixMismatches: true, delayFirstSync: STARTUP_CONFIG.ORDER_SYNC_DELAY_MS });

      setTimeout(() => {
        void import('./services/startup-audit').then(({ runStartupAudit }) => {
          runStartupAudit().catch((err) => {
            fastify.log.error({ err }, '[startup-audit] Unhandled error');
          });
        });
      }, STARTUP_CONFIG.AUDIT_DELAY_MS);

      const { startIncomeSync } = await import('./services/income-events');
      startIncomeSync({ delayFirstSync: STARTUP_CONFIG.INCOME_SYNC_DELAY_MS });

      const { indicatorSchedulerService } = await import('./services/indicator-scheduler');
      await indicatorSchedulerService.start();

      const { binanceBookTickerStreamService } = await import('./services/binance-book-ticker-stream');
      const { binanceMarkPriceStreamService } = await import('./services/binance-mark-price-stream');
      const { binanceAggTradeStreamService } = await import('./services/binance-agg-trade-stream');
      const { binanceDepthStreamService } = await import('./services/binance-depth-stream');
      const { createBinanceClientForPrices } = await import('./services/binance-client');

      binanceBookTickerStreamService.start();
      binanceMarkPriceStreamService.start();
      binanceAggTradeStreamService.start();
      binanceDepthStreamService.start(createBinanceClientForPrices());

      const { heatmapAlwaysCollectSymbols } = await import('./db/schema');
      const alwaysCollectRows = await db.select().from(heatmapAlwaysCollectSymbols);
      const symbols = alwaysCollectRows.length > 0
        ? alwaysCollectRows.map(r => r.symbol)
        : ['BTCUSDT'];
      for (const s of symbols) binanceDepthStreamService.subscribe(s.toLowerCase());

      const { binanceLiquidationStreamService } = await import('./services/binance-liquidation-stream');
      binanceLiquidationStreamService.start();

      const { liquidityHeatmapAggregator } = await import('./services/liquidity-heatmap-aggregator');
      liquidityHeatmapAggregator.start(binanceDepthStreamService, binanceLiquidationStreamService, symbols);

      setTimeout(() => {
        void (async () => {
          try {
            const { getScalpingScheduler } = await import('./services/scalping/scalping-scheduler');
            await getScalpingScheduler().restoreFromDb();
          } catch (err) {
            fastify.log.error({ err }, '[scalping-scheduler] Failed to restore from DB');
          }
        })();
      }, STARTUP_CONFIG.AUDIT_DELAY_MS);

      fastify.log.info(`> Backend server running on http://localhost:${port}`);
      fastify.log.info(`> tRPC endpoint: http://localhost:${port}/trpc`);
      fastify.log.info(`> WebSocket server initialized`);
      fastify.log.info(`> Position monitor service started`);
      fastify.log.info(`> Binance price stream service started`);
      fastify.log.info(`> Binance kline stream service started (SPOT + FUTURES)`);
      fastify.log.info(`> Binance user stream service started (SPOT + FUTURES)`);
      fastify.log.info(`> Indicator scheduler started (snapshots every 30min)`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

void start();

export type { AppRouter } from './trpc/router';
