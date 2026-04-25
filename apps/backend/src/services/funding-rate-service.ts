import { calculateFundingPayment } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { FUNDING, TIME_MS } from '../constants';
import { db } from '../db';
import { positions, wallets } from '../db/schema';
import { isPaperWallet } from './binance-futures-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger } from './logger';

const CHECK_INTERVAL_MS = 5 * TIME_MS.MINUTE;

interface FundingRateCache {
  rate: number;
  nextFundingTime: number;
  lastAppliedTime: number;
}

class FundingRateService {
  private fundingCache: Map<string, FundingRateCache> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      void this.processFundingRates();
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('[FundingRateService] Stopped');
  }

  async processFundingRates(): Promise<void> {
    try {
      const openFuturesPositions = await db
        .select({
          position: positions,
          wallet: wallets,
        })
        .from(positions)
        .innerJoin(wallets, eq(positions.walletId, wallets.id))
        .where(
          and(
            eq(positions.status, 'open'),
            eq(positions.marketType, 'FUTURES')
          )
        );

      if (openFuturesPositions.length === 0) return;

      const symbolPositions = new Map<string, typeof openFuturesPositions>();
      for (const pos of openFuturesPositions) {
        const existing = symbolPositions.get(pos.position.symbol) ?? [];
        existing.push(pos);
        symbolPositions.set(pos.position.symbol, existing);
      }

      for (const [symbol, positionsForSymbol] of symbolPositions) {
        const paperPositions = positionsForSymbol.filter(p => isPaperWallet(p.wallet));
        if (paperPositions.length === 0) continue;

        await this.applyFundingToPositions(symbol, paperPositions);
      }
    } catch (error) {
      logger.error({ error }, '[FundingRateService] Error processing funding rates');
    }
  }

  private async applyFundingToPositions(
    symbol: string,
    positionsData: Array<{ position: typeof positions.$inferSelect; wallet: typeof wallets.$inferSelect }>
  ): Promise<void> {
    try {
      const dataService = getBinanceFuturesDataService();
      const fundingInfo = await dataService.getCurrentFundingRate(symbol);

      if (!fundingInfo) {
        logger.trace({ symbol }, '[FundingRateService] No funding rate available');
        return;
      }

      const fundingRate = fundingInfo.rate;
      const nextFundingTime = fundingInfo.nextFundingTime;
      const now = Date.now();

      const lastFundingTime = nextFundingTime - FUNDING.INTERVAL_MS;

      const cache = this.fundingCache.get(symbol);

      if (cache && cache.lastAppliedTime >= lastFundingTime) {
        return;
      }

      const shouldApply = now >= lastFundingTime && (!cache || cache.lastAppliedTime < lastFundingTime);

      if (!shouldApply) return;

      logger.info({
        symbol,
        fundingRate: `${(fundingRate * 100).toFixed(4)}%`,
        lastFundingTime: new Date(lastFundingTime).toISOString(),
        nextFundingTime: new Date(nextFundingTime).toISOString(),
        positionCount: positionsData.length,
      }, '[FundingRateService] Applying funding rate to paper positions');

      for (const { position } of positionsData) {
        const entryPrice = parseFloat(position.entryPrice);
        const quantity = parseFloat(position.entryQty);
        const positionValue = entryPrice * quantity;

        const fundingPayment = calculateFundingPayment(
          positionValue,
          fundingRate,
          position.side
        );

        const currentAccumulated = parseFloat(position.accumulatedFunding ?? '0');
        const newAccumulated = currentAccumulated + fundingPayment;

        await db
          .update(positions)
          .set({
            accumulatedFunding: newAccumulated.toString(),
            updatedAt: new Date(),
          })
          .where(eq(positions.id, position.id));

        logger.info({
          positionId: position.id,
          symbol: position.symbol,
          side: position.side,
          positionValue: positionValue.toFixed(2),
          fundingPayment: fundingPayment.toFixed(4),
          previousAccumulated: currentAccumulated.toFixed(4),
          newAccumulated: newAccumulated.toFixed(4),
        }, '[FundingRateService] Applied funding payment');
      }

      this.fundingCache.set(symbol, {
        rate: fundingRate,
        nextFundingTime,
        lastAppliedTime: lastFundingTime,
      });
    } catch (error) {
      logger.error({ symbol, error }, '[FundingRateService] Error applying funding to positions');
    }
  }

  async getFundingRateForSymbol(symbol: string): Promise<{ rate: number; nextFundingTime: Date } | null> {
    try {
      const dataService = getBinanceFuturesDataService();
      const fundingInfo = await dataService.getCurrentFundingRate(symbol);

      if (!fundingInfo) return null;

      return {
        rate: fundingInfo.rate,
        nextFundingTime: new Date(fundingInfo.nextFundingTime),
      };
    } catch (error) {
      logger.error({ symbol, error }, '[FundingRateService] Error getting funding rate');
      return null;
    }
  }
}

export const fundingRateService = new FundingRateService();
