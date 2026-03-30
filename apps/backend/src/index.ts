import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { STARTUP_CONFIG } from './constants';
import { db } from './db/client';
import { env } from './env';
import { initializeKlineMaintenance } from './services/kline-maintenance';
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
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
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
          fastify.log.error({ path, error }, 'tRPC error');
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

    const port = parseInt(env.PORT, 10);
    await fastify.listen({ port, host: '0.0.0.0' });

    const websocketService = initializeWebSocket(fastify.server);
    setWebSocketService(websocketService);

    const [
      { positionMonitorService },
      { binancePriceStreamService },
      { binanceKlineStreamService, binanceFuturesKlineStreamService },
      { binanceUserStreamService },
      { binanceFuturesUserStreamService },
      { positionSyncService },
    ] = await Promise.all([
      import('./services/position-monitor'),
      import('./services/binance-price-stream'),
      import('./services/binance-kline-stream'),
      import('./services/binance-user-stream'),
      import('./services/binance-futures-user-stream'),
      import('./services/position-sync'),
    ]);

    positionMonitorService.start();
    binancePriceStreamService.start();
    binanceKlineStreamService.start();
    binanceFuturesKlineStreamService.start();

    await Promise.all([
      binanceUserStreamService.start(),
      binanceFuturesUserStreamService.start(),
      positionSyncService.start(),
    ]);

    const { startCustomSymbolService } = await import('./services/custom-symbol-service');
    await startCustomSymbolService();
    fastify.log.info('> Custom symbol service started');

    const { autoTradingScheduler } = await import('./services/auto-trading-scheduler');
    await autoTradingScheduler.restoreWatchersFromDb();

    const { cooldownService } = await import('./services/cooldown');
    cooldownService.startCleanupScheduler(60);

    const { startCleanupScheduler } = await import('./services/cleanup');
    startCleanupScheduler();

    const { fundingRateService } = await import('./services/funding-rate-service');
    fundingRateService.start();

    const klineMaintenance = initializeKlineMaintenance();
    await klineMaintenance.start({ skipStartupSync: true, delayMs: STARTUP_CONFIG.KLINE_MAINTENANCE_DELAY_MS });

    const { orderSyncService } = await import('./services/order-sync');
    await orderSyncService.start({ autoCancelOrphans: false, autoFixMismatches: true, delayFirstSync: STARTUP_CONFIG.ORDER_SYNC_DELAY_MS });

    setTimeout(() => {
      import('./services/startup-audit').then(({ runStartupAudit }) => {
        runStartupAudit().catch((err) => {
          fastify.log.error({ err }, '[startup-audit] Unhandled error');
        });
      });
    }, STARTUP_CONFIG.AUDIT_DELAY_MS);

    const { incomeSyncService } = await import('./services/income-sync-service');
    incomeSyncService.start({ delayFirstSync: STARTUP_CONFIG.INCOME_SYNC_DELAY_MS });

    const { indicatorSchedulerService } = await import('./services/indicator-scheduler');
    await indicatorSchedulerService.start();

    const { binanceBookTickerStreamService } = await import('./services/binance-book-ticker-stream');
    const { binanceAggTradeStreamService } = await import('./services/binance-agg-trade-stream');
    const { binanceDepthStreamService } = await import('./services/binance-depth-stream');
    const { createBinanceClientForPrices } = await import('./services/binance-client');

    binanceBookTickerStreamService.start();
    binanceAggTradeStreamService.start();
    binanceDepthStreamService.start(createBinanceClientForPrices());

    const { liquidityHeatmapAggregator } = await import('./services/liquidity-heatmap-aggregator');
    liquidityHeatmapAggregator.start(binanceDepthStreamService);

    const { heatmapAlwaysCollectSymbols } = await import('./db/schema');
    const alwaysCollectRows = await db.select().from(heatmapAlwaysCollectSymbols);
    const alwaysCollectSymbols = alwaysCollectRows.length > 0
      ? alwaysCollectRows.map(r => r.symbol.toLowerCase())
      : ['btcusdt'];
    for (const s of alwaysCollectSymbols) binanceDepthStreamService.subscribe(s);

    setTimeout(async () => {
      try {
        const { getScalpingScheduler } = await import('./services/scalping/scalping-scheduler');
        await getScalpingScheduler().restoreFromDb();
      } catch (err) {
        fastify.log.error({ err }, '[scalping-scheduler] Failed to restore from DB');
      }
    }, STARTUP_CONFIG.AUDIT_DELAY_MS);

    fastify.log.info(`> Backend server running on http://localhost:${port}`);
    fastify.log.info(`> tRPC endpoint: http://localhost:${port}/trpc`);
    fastify.log.info(`> WebSocket server initialized`);
    fastify.log.info(`> Position monitor service started`);
    fastify.log.info(`> Binance price stream service started`);
    fastify.log.info(`> Binance kline stream service started (SPOT + FUTURES)`);
    fastify.log.info(`> Binance user stream service started (SPOT + FUTURES)`);
    fastify.log.info(`> Kline maintenance service started (delayed ${STARTUP_CONFIG.KLINE_MAINTENANCE_DELAY_MS / 1000}s)`);
    fastify.log.info(`> Indicator scheduler started (snapshots every 30min)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export type { AppRouter } from './trpc/router';
