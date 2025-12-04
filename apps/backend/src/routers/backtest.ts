import type { Interval } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { SetupDetectionService } from '../services/setup-detection/SetupDetectionService';
import { protectedProcedure, router } from '../trpc';

const generateId = (length: number): string => {
  return randomBytes(length).toString('base64url').slice(0, length);
};

// In-memory storage for backtest results (could be moved to DB later)
const backtestResults = new Map<string, any>();

export const backtestRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        initialCapital: z.number().positive(),
        minProfitPercent: z.number().min(0).optional(),
        setupTypes: z.array(z.string()).optional(),
        minConfidence: z.number().min(0).max(100).optional(),
        onlyWithTrend: z.boolean().optional().default(true),
        useAlgorithmicLevels: z.boolean().optional().default(false),
        stopLossPercent: z.number().positive().optional(),
        takeProfitPercent: z.number().positive().optional(),
        maxPositionSize: z.number().min(0).max(100).optional().default(10),
        commission: z.number().min(0).max(1).optional().default(0.001), // 0.1%
      })
    )
    .mutation(async ({ input }) => {
      const backtestId = generateId(21);
      const startTime = Date.now();

      try {
        // Set initial status
        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'RUNNING',
          config: input,
          startTime: new Date().toISOString(),
        });

        console.log('[Backtest] Starting backtest', backtestId, 'for', input.symbol, input.interval);
        console.log('[Backtest] Date range:', input.startDate, 'to', input.endDate);

        // 1. Fetch historical klines directly from Binance API (not from DB)
        console.log('[Backtest] Fetching historical klines from Binance API...');
        const historicalKlines = await fetchHistoricalKlinesFromAPI(
          input.symbol,
          input.interval as Interval,
          new Date(input.startDate),
          new Date(input.endDate)
        );

        console.log('[Backtest] Fetched', historicalKlines.length, 'klines from API');

        if (historicalKlines.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No historical data available for the specified period',
          });
        }

        // 2. Klines already in expected format from API
        console.log('[Backtest] Sample kline:', historicalKlines[0]);

        // 3. Detect setups in the historical data across the entire date range
        console.log('[Backtest] Detecting setups in', historicalKlines.length, 'klines');
        console.log('[Backtest] Requested setup types:', input.setupTypes);
        
        // Enable only the setups that were requested, or all if none specified
        const setupsToEnable = input.setupTypes?.length ? input.setupTypes : [
          'setup91', 'setup92', 'setup93', 'setup94', 'pattern123',
          'bullTrap', 'bearTrap', 'breakoutRetest', 'pinInside',
          'orderBlockFVG', 'vwapEmaCross', 'divergence', 'liquiditySweep'
        ];
        
        // Import default configs from individual files
        const { createDefault91Config } = await import('../services/setup-detection/Setup91Detector');
        const { createDefault92Config } = await import('../services/setup-detection/Setup92Detector');
        const { createDefault93Config } = await import('../services/setup-detection/Setup93Detector');
        const { createDefault94Config } = await import('../services/setup-detection/Setup94Detector');
        const { createDefault123Config } = await import('../services/setup-detection/Pattern123Detector');
        const { createDefaultBullTrapConfig } = await import('../services/setup-detection/BullTrapDetector');
        const { createDefaultBearTrapConfig } = await import('../services/setup-detection/BearTrapDetector');
        const { createDefaultBreakoutRetestConfig } = await import('../services/setup-detection/BreakoutRetestDetector');
        const { createDefaultPinInsideConfig } = await import('../services/setup-detection/PinInsideDetector');
        const { createDefaultOrderBlockFVGConfig } = await import('../services/setup-detection/OrderBlockFVGDetector');
        const { createDefaultVWAPEMACrossConfig } = await import('../services/setup-detection/VWAPEMACrossDetector');
        const { createDefaultDivergenceConfig } = await import('../services/setup-detection/DivergenceDetector');
        const { createDefaultLiquiditySweepConfig } = await import('../services/setup-detection/LiquiditySweepDetector');
        
        // Create setup config with defaults + relaxed settings for backtesting
        const setupConfig: any = {
          setup91: { ...createDefault91Config(), enabled: setupsToEnable.includes('setup91'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          setup92: { ...createDefault92Config(), enabled: setupsToEnable.includes('setup92'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          setup93: { ...createDefault93Config(), enabled: setupsToEnable.includes('setup93'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          setup94: { ...createDefault94Config(), enabled: setupsToEnable.includes('setup94'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          pattern123: { ...createDefault123Config(), enabled: setupsToEnable.includes('pattern123'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          bullTrap: { ...createDefaultBullTrapConfig(), enabled: setupsToEnable.includes('bullTrap'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          bearTrap: { ...createDefaultBearTrapConfig(), enabled: setupsToEnable.includes('bearTrap'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          breakoutRetest: { ...createDefaultBreakoutRetestConfig(), enabled: setupsToEnable.includes('breakoutRetest'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          pinInside: { ...createDefaultPinInsideConfig(), enabled: setupsToEnable.includes('pinInside'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          orderBlockFVG: { ...createDefaultOrderBlockFVGConfig(), enabled: setupsToEnable.includes('orderBlockFVG'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          vwapEmaCross: { ...createDefaultVWAPEMACrossConfig(), enabled: setupsToEnable.includes('vwapEmaCross'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          divergence: { ...createDefaultDivergenceConfig(), enabled: setupsToEnable.includes('divergence'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
          liquiditySweep: { ...createDefaultLiquiditySweepConfig(), enabled: setupsToEnable.includes('liquiditySweep'), minConfidence: input.minConfidence ?? 0, minRiskReward: 0 },
        };
        
        console.log('[Backtest] Enabled setups:', Object.keys(setupConfig).filter(k => setupConfig[k].enabled));
        const setupDetectionService = new SetupDetectionService(setupConfig);
        
        let detectedSetups: any[] = [];
        try {
          // Use detectSetupsInRange to scan all klines from start to end
          const MIN_KLINES = 50; // Minimum klines needed for detection
          const startIndex = MIN_KLINES; // Start after minimum required for indicators
          const endIndex = historicalKlines.length - 1; // Scan until the last kline
          
          console.log(`[Backtest] Scanning from index ${startIndex} to ${endIndex} (${endIndex - startIndex + 1} candles)`);
          
          detectedSetups = setupDetectionService.detectSetupsInRange(
            historicalKlines,
            startIndex,
            endIndex
          );
          console.log('[Backtest] Detected', detectedSetups.length, 'setups');
          if (detectedSetups.length > 0) {
            const setupTypes = detectedSetups.reduce((acc: any, s: any) => {
              acc[s.type] = (acc[s.type] || 0) + 1;
              return acc;
            }, {});
            console.log('[Backtest] Setup breakdown:', setupTypes);
          }
        } catch (error) {
          console.error('[Backtest] Error detecting setups:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Setup detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            cause: error,
          });
        }

        // Filter by minimum confidence if specified (only filter if minConfidence > 0)
        const tradableSetups = input.minConfidence && input.minConfidence > 0
          ? detectedSetups.filter((s: any) => s.confidence >= input.minConfidence!)
          : detectedSetups;

        console.log('[Backtest] Filtered to', tradableSetups.length, 'tradable setups by confidence', input.minConfidence ? `(min: ${input.minConfidence}%)` : '(no filter)');

        // 4. Simulate trading based on setups
        const trades: any[] = [];
        let equity = input.initialCapital;
        let peakEquity = input.initialCapital;
        let maxDrawdown = 0;
        const MIN_NOTIONAL_VALUE = 10; // Binance minimum order value
        
        const equityCurve: any[] = [
          {
            time: input.startDate,
            equity: input.initialCapital,
            drawdown: 0,
            drawdownPercent: 0,
          },
        ];

        const klineMap = new Map(
          historicalKlines.map((k) => [k.openTime, k])
        );

        // Calculate EMA200 for trend detection if onlyWithTrend is enabled
        let ema200: (number | null)[] = [];
        if (input.onlyWithTrend) {
          const { calculateEMA } = await import('@marketmind/indicators');
          ema200 = calculateEMA(historicalKlines, 200);
        }

        // Sort setups by openTime
        const sortedSetups = tradableSetups.sort(
          (a: any, b: any) => a.openTime - b.openTime
        );

        for (const setup of sortedSetups) {
          const entryKline = klineMap.get(setup.openTime);

          if (!entryKline) {
            console.warn('[Backtest] Entry kline not found for setup', setup.id, 'at', setup.openTime);
            continue;
          }

          const entryPrice = parseFloat(entryKline.close);
          
          // Filter by trend if enabled
          if (input.onlyWithTrend && ema200.length > 0) {
            const setupIndex = historicalKlines.findIndex(k => k.openTime === setup.openTime);
            const ema200Value = ema200[setupIndex];
            
            if (ema200Value !== null && ema200Value !== undefined) {
              const isBullishTrend = entryPrice > ema200Value;
              const isBearishTrend = entryPrice < ema200Value;
              
              // Skip if setup direction doesn't align with trend
              if (setup.direction === 'LONG' && !isBullishTrend) {
                console.warn('[Backtest] Skipping LONG setup - price below EMA200 (counter-trend)');
                continue;
              }
              if (setup.direction === 'SHORT' && !isBearishTrend) {
                console.warn('[Backtest] Skipping SHORT setup - price above EMA200 (counter-trend)');
                continue;
              }
            }
          }
          
          const positionSize = (equity * (input.maxPositionSize / 100)) / entryPrice;
          const positionValue = positionSize * entryPrice;
          
          // Ensure position value meets Binance minimum
          if (positionValue < MIN_NOTIONAL_VALUE) {
            console.warn('[Backtest] Position value', positionValue.toFixed(2), 'below Binance MIN_NOTIONAL (', MIN_NOTIONAL_VALUE, '), skipping trade');
            continue;
          }

          // Calculate SL/TP
          const stopLoss = input.useAlgorithmicLevels && setup.stopLoss
            ? setup.stopLoss
            : input.stopLossPercent
            ? setup.direction === 'LONG'
              ? entryPrice * (1 - input.stopLossPercent / 100)
              : entryPrice * (1 + input.stopLossPercent / 100)
            : undefined;

          const takeProfit = input.useAlgorithmicLevels && setup.takeProfit
            ? setup.takeProfit
            : input.takeProfitPercent
            ? setup.direction === 'LONG'
              ? entryPrice * (1 + input.takeProfitPercent / 100)
              : entryPrice * (1 - input.takeProfitPercent / 100)
            : undefined;

          // Filter by minimum expected profit after fees
          if (input.minProfitPercent && takeProfit) {
            const expectedProfitPercent = setup.direction === 'LONG'
              ? ((takeProfit - entryPrice) / entryPrice) * 100
              : ((entryPrice - takeProfit) / entryPrice) * 100;
            
            const profitAfterFees = expectedProfitPercent - (input.commission * 200); // 2x commission (entry + exit)
            
            if (profitAfterFees < input.minProfitPercent) {
              console.warn(
                '[Backtest] Skipping setup - expected profit after fees',
                `${profitAfterFees.toFixed(2)  }%`,
                'is below minimum',
                `${input.minProfitPercent  }%`
              );
              continue;
            }
          }

          // Find exit
          let exitPrice: number | undefined;
          let exitTime: string | undefined;
          let exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_PERIOD' | undefined;

          const futureKlines = historicalKlines.filter(
            (k) => k.openTime > setup.openTime
          );

          for (const futureKline of futureKlines) {
            const high = parseFloat(futureKline.high);
            const low = parseFloat(futureKline.low);

            // Check stop loss
            if (stopLoss) {
              if (
                (setup.direction === 'LONG' && low <= stopLoss) ||
                (setup.direction === 'SHORT' && high >= stopLoss)
              ) {
                exitPrice = stopLoss;
                exitTime = new Date(futureKline.openTime).toISOString();
                exitReason = 'STOP_LOSS';
                break;
              }
            }

            // Check take profit
            if (takeProfit) {
              if (
                (setup.direction === 'LONG' && high >= takeProfit) ||
                (setup.direction === 'SHORT' && low <= takeProfit)
              ) {
                exitPrice = takeProfit;
                exitTime = new Date(futureKline.openTime).toISOString();
                exitReason = 'TAKE_PROFIT';
                break;
              }
            }
          }

          // If no exit found, close at end of period
          if (!exitPrice) {
            const lastKline = historicalKlines[historicalKlines.length - 1];
            exitPrice = parseFloat(lastKline!.close);
            exitTime = new Date(lastKline!.openTime).toISOString();
            exitReason = 'END_OF_PERIOD';
          }

          // Calculate PnL
          const priceDiff =
            setup.direction === 'LONG'
              ? exitPrice - entryPrice
              : entryPrice - exitPrice;

          const pnl = priceDiff * positionSize;
          const commission = positionValue * input.commission * 2; // Entry + Exit
          const netPnl = pnl - commission;
          const pnlPercent = (netPnl / positionValue) * 100;

          // Update equity
          equity += netPnl;

          // Track drawdown
          if (equity > peakEquity) {
            peakEquity = equity;
          }
          const currentDrawdown = peakEquity - equity;
          const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

          if (currentDrawdown > maxDrawdown) {
            maxDrawdown = currentDrawdown;
          }

          // Record trade
          const trade = {
            id: generateId(16),
            setupId: setup.id,
            setupType: setup.type,
            setupConfidence: setup.confidence,
            entryTime: new Date(setup.openTime).toISOString(),
            entryPrice,
            exitTime,
            exitPrice,
            side: setup.direction,
            quantity: positionSize,
            stopLoss,
            takeProfit,
            pnl,
            pnlPercent,
            commission,
            netPnl,
            exitReason,
            status: 'CLOSED' as const,
          };

          trades.push(trade);

          // Update equity curve
          if (exitTime) {
            equityCurve.push({
              time: exitTime,
              equity,
              drawdown: currentDrawdown,
              drawdownPercent: currentDrawdownPercent,
            });
          }
        }

        // 5. Calculate metrics
        const winningTrades = trades.filter((t) => (t.netPnl ?? 0) > 0);
        const losingTrades = trades.filter((t) => (t.netPnl ?? 0) < 0);

        const totalPnl = trades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
        const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

        const totalWins = winningTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
        const totalLosses = Math.abs(
          losingTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0)
        );

        // Calculate trade durations
        const calculateDuration = (trade: any) => {
          if (!trade.exitTime) return 0;
          const entry = new Date(trade.entryTime).getTime();
          const exit = new Date(trade.exitTime).getTime();
          return (exit - entry) / (1000 * 60); // minutes
        };

        const avgTradeDuration = trades.length > 0
          ? trades.reduce((sum, t) => sum + calculateDuration(t), 0) / trades.length
          : 0;

        const avgWinDuration = winningTrades.length > 0
          ? winningTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / winningTrades.length
          : 0;

        const avgLossDuration = losingTrades.length > 0
          ? losingTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / losingTrades.length
          : 0;

        const metrics = {
          totalTrades: trades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,

          totalPnl,
          totalPnlPercent: (totalPnl / input.initialCapital) * 100,
          avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
          avgPnlPercent:
            trades.length > 0
              ? trades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / trades.length
              : 0,

          avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
          avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
          largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.netPnl ?? 0)) : 0,
          largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.netPnl ?? 0)) : 0,
          profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,

          maxDrawdown,
          maxDrawdownPercent: (maxDrawdown / peakEquity) * 100,

          totalCommission,

          avgTradeDuration,
          avgWinDuration,
          avgLossDuration,
          sharpeRatio: 0,
        };

        // 5. Calculate Sharpe Ratio (simplified)
        if (trades.length > 1) {
          const returns = trades.map((t) => t.pnlPercent ?? 0);
          const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const variance =
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            (returns.length - 1);
          const stdDev = Math.sqrt(variance);
          metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log('[Backtest] Completed in', (duration / 1000).toFixed(2), 'seconds');
        console.log('[Backtest] Results:', {
          trades: trades.length,
          winRate: `${metrics.winRate.toFixed(2)}%`,
          totalPnl: `${metrics.totalPnl.toFixed(2)} USDT (${metrics.totalPnlPercent.toFixed(2)}%)`,
          finalEquity: `${equity.toFixed(2)} USDT`,
          maxDrawdown: `${metrics.maxDrawdown.toFixed(2)} USDT (${metrics.maxDrawdownPercent.toFixed(2)}%)`,
          profitFactor: metrics.profitFactor.toFixed(2),
        });

        const result = {
          id: backtestId,
          config: input,
          trades,
          metrics,
          equityCurve,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration,
          status: 'COMPLETED' as const,
        };

        // Store result
        backtestResults.set(backtestId, result);

        return result;
      } catch (error) {
        console.error('[Backtest] Error during backtest:', error);
        console.error('[Backtest] Stack trace:', error instanceof Error ? error.stack : 'N/A');
        
        backtestResults.set(backtestId, {
          id: backtestId,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          config: input,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          cause: error,
        });
      }
    }),

  getResult: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = backtestResults.get(input.id);

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return result;
    }),

  list: protectedProcedure.query(async () => {
    const results = Array.from(backtestResults.values())
      .map((result) => ({
        id: result.id,
        symbol: result.config.symbol,
        interval: result.config.interval,
        startDate: result.config.startDate,
        endDate: result.config.endDate,
        initialCapital: result.config.initialCapital,
        finalEquity: result.metrics?.totalPnl
          ? result.config.initialCapital + result.metrics.totalPnl
          : result.config.initialCapital,
        totalPnl: result.metrics?.totalPnl ?? 0,
        totalPnlPercent: result.metrics?.totalPnlPercent ?? 0,
        winRate: result.metrics?.winRate ?? 0,
        totalTrades: result.metrics?.totalTrades ?? 0,
        maxDrawdown: result.metrics?.maxDrawdown ?? 0,
        sharpeRatio: result.metrics?.sharpeRatio,
        createdAt: result.startTime,
        status: result.status,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results;
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const deleted = backtestResults.delete(input.id);

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Backtest result not found',
        });
      }

      return { success: true };
    }),
});
