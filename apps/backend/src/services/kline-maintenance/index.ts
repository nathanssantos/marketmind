import type { Interval } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { COOLDOWN_GAP_CHECK, COOLDOWN_CORRUPTION_CHECK, TIME_MS } from '../../constants';
import { db } from '../../db';
import { pairMaintenanceLog } from '../../db/schema';
import { logger, serializeError } from '../logger';
import {
  MaintenanceLogBuffer,
  outputMaintenanceResults,
  type CorruptionFixEntry,
} from '../watcher-batch-logger';
import { getActivePairsWithSubscriptions } from './active-pairs';
import { detectAndFixCorruptedKlines, detectAndFixMisalignedKlines } from './corruption-detection';
import { detectGaps, fillGap } from './gap-detection';
import { shouldCheckGaps, shouldCheckCorruption, updateMaintenanceLog } from './maintenance-log';
import { checkAfterReconnection } from './reconnection-validator';
import type { ActivePair, GapInfo, KlineMaintenanceStartOptions } from './types';

const GAP_CHECK_INTERVAL = 2 * TIME_MS.HOUR;

class KlineMaintenance {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private gapCheckCooldownMs = COOLDOWN_GAP_CHECK;
  private corruptionCheckCooldownMs = COOLDOWN_CORRUPTION_CHECK;

  async start(options: KlineMaintenanceStartOptions = {}): Promise<void> {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      await this.checkAndFillGaps();
    }, GAP_CHECK_INTERVAL);

    if (options.skipStartupSync) {
      if (options.delayMs) {
        setTimeout(() => void this.runStartupSync(), options.delayMs);
      }
      return;
    }

    await this.runStartupSync();
  }

  private async runStartupSync(): Promise<void> {
    const logBuffer = new MaintenanceLogBuffer('startup');

    const [gapResults] = await Promise.all([
      this.checkAllStoredPairs(logBuffer),
      this.checkCorruptionOnStartup(logBuffer),
    ]);

    logBuffer.setPairsChecked(gapResults.pairsChecked);

    outputMaintenanceResults(logBuffer.toResult());

    await this.checkAndFillGaps();
  }

  private async checkCorruptionOnStartup(logBuffer?: MaintenanceLogBuffer): Promise<{ pairsChecked: number }> {
    try {
      const activePairs = await this.getActivePairs();

      if (activePairs.length === 0) return { pairsChecked: 0 };

      for (const pair of activePairs) {
        try {
          const { corruptedFound, fixed } = await detectAndFixCorruptedKlines(pair, true);

          await updateMaintenanceLog(pair, { corruptedFixed: fixed, checkType: 'corruption' });

          if (logBuffer && corruptedFound > 0) {
            const entry: CorruptionFixEntry = {
              symbol: pair.symbol,
              interval: pair.interval,
              marketType: pair.marketType,
              corruptedFound,
              fixed,
              status: fixed === corruptedFound ? 'success' : fixed > 0 ? 'partial' : 'error',
            };
            logBuffer.addCorruptionFix(entry);
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking corruption for pair on startup');
        }
      }

      return { pairsChecked: activePairs.length };
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in startup corruption check');
      return { pairsChecked: 0 };
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAllStoredPairs(logBuffer?: MaintenanceLogBuffer): Promise<{ pairsChecked: number }> {
    try {
      const activePairs = await getActivePairsWithSubscriptions();

      for (const activePair of activePairs) {
        try {
          if (!(await shouldCheckGaps(activePair, this.gapCheckCooldownMs))) {
            if (logBuffer) {
              logBuffer.addGapFill({
                symbol: activePair.symbol,
                interval: activePair.interval,
                marketType: activePair.marketType,
                gapsFound: 0,
                candlesFilled: 0,
                status: 'skipped',
                reason: 'Cooldown active',
              });
            }
            continue;
          }

          const gaps = await detectGaps(activePair);
          let totalFilled = 0;

          const GAP_BATCH_SIZE = 3;
          for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
            const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
            const results = await Promise.all(batch.map(gap => fillGap(gap, true).catch(() => 0)));
            totalFilled += results.reduce((sum, n) => sum + n, 0);
          }

          await updateMaintenanceLog(activePair, { gapsFound: gaps.length, checkType: 'gap' });

          if (logBuffer && (gaps.length > 0 || totalFilled > 0)) {
            logBuffer.addGapFill({
              symbol: activePair.symbol,
              interval: activePair.interval,
              marketType: activePair.marketType,
              gapsFound: gaps.length,
              candlesFilled: totalFilled,
              status: totalFilled > 0 ? 'success' : gaps.length > 0 ? 'partial' : 'success',
            });
          }
        } catch (error) {
          logger.error({ activePair, error }, 'Error checking gaps for active pair');
          if (logBuffer) {
            logBuffer.addGapFill({
              symbol: activePair.symbol,
              interval: activePair.interval,
              marketType: activePair.marketType,
              gapsFound: 0,
              candlesFilled: 0,
              status: 'error',
              reason: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return { pairsChecked: activePairs.length };
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in initial gap check');
      return { pairsChecked: 0 };
    }
  }

  async checkAndFillGaps(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      const activePairs = await this.getActivePairs();
      if (activePairs.length === 0) return;

      const logBuffer = new MaintenanceLogBuffer('periodic');
      logBuffer.setPairsChecked(activePairs.length);

      for (const pair of activePairs) {
        try {
          if (await shouldCheckGaps(pair, this.gapCheckCooldownMs)) {
            const gaps = await detectGaps(pair);
            let totalFilled = 0;

            const GAP_BATCH_SIZE = 3;
            for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
              const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
              const results = await Promise.all(batch.map(gap => fillGap(gap, true).catch(() => 0)));
              totalFilled += results.reduce((sum, n) => sum + n, 0);
            }

            await updateMaintenanceLog(pair, { gapsFound: gaps.length, checkType: 'gap' });

            if (gaps.length > 0 || totalFilled > 0) {
              logBuffer.addGapFill({
                symbol: pair.symbol,
                interval: pair.interval,
                marketType: pair.marketType,
                gapsFound: gaps.length,
                candlesFilled: totalFilled,
                status: totalFilled > 0 ? 'success' : gaps.length > 0 ? 'partial' : 'success',
              });
            }
          }

          if (await shouldCheckCorruption(pair, this.corruptionCheckCooldownMs)) {
            const { corruptedFound, fixed } = await detectAndFixCorruptedKlines(pair, true);

            await updateMaintenanceLog(pair, { corruptedFixed: fixed, checkType: 'corruption' });

            if (corruptedFound > 0) {
              logBuffer.addCorruptionFix({
                symbol: pair.symbol,
                interval: pair.interval,
                marketType: pair.marketType,
                corruptedFound,
                fixed,
                status: fixed === corruptedFound ? 'success' : fixed > 0 ? 'partial' : 'error',
              });
            }
          }
        } catch (error) {
          logger.error({ pair, error }, 'Error checking gaps for pair');
        }
      }

      outputMaintenanceResults(logBuffer.toResult());
    } catch (error) {
      logger.error({ error: serializeError(error) }, 'Error in gap check cycle');
    } finally {
      this.isRunning = false;
    }
  }

  private async getActivePairs(): Promise<ActivePair[]> {
    return getActivePairsWithSubscriptions();
  }

  async forceCheckSymbol(symbol: string, interval: Interval, marketType: 'SPOT' | 'FUTURES' = 'FUTURES'): Promise<{ gapsFilled: number; corruptedFixed: number }> {
    const pair: ActivePair = { symbol, interval, marketType };

    const misalignedDeleted = await detectAndFixMisalignedKlines(pair);

    const gaps = await detectGaps(pair);
    let gapsFilled = misalignedDeleted;

    const GAP_BATCH_SIZE = 3;
    for (let i = 0; i < gaps.length; i += GAP_BATCH_SIZE) {
      const batch = gaps.slice(i, i + GAP_BATCH_SIZE);
      const results = await Promise.all(batch.map(gap => fillGap(gap).catch(() => 0)));
      gapsFilled += results.reduce((sum, n) => sum + n, 0);
    }

    const { fixed: corruptedFixed } = await detectAndFixCorruptedKlines(pair, true);

    await updateMaintenanceLog(pair, { gapsFound: gaps.length + misalignedDeleted, checkType: 'gap' });
    await updateMaintenanceLog(pair, { corruptedFixed, checkType: 'corruption' });

    return { gapsFilled, corruptedFixed };
  }

  async checkAfterReconnection(): Promise<{ checked: number; fixed: number }> {
    const activePairs = await this.getActivePairs();
    return checkAfterReconnection(activePairs);
  }

  getCooldowns(): { gapCheckMs: number; corruptionCheckMs: number } {
    return { gapCheckMs: this.gapCheckCooldownMs, corruptionCheckMs: this.corruptionCheckCooldownMs };
  }

  setCooldowns(gapCheckMs: number, corruptionCheckMs: number): void {
    this.gapCheckCooldownMs = gapCheckMs;
    this.corruptionCheckCooldownMs = corruptionCheckMs;
    logger.info({ gapCheckMs, corruptionCheckMs }, '[KlineMaintenance] Cooldowns updated');
  }

  async repairAll(): Promise<{ pairsChecked: number; gapsFilled: number; corruptedFixed: number }> {
    const activePairs = await this.getActivePairs();
    let totalGapsFilled = 0;
    let totalCorruptedFixed = 0;

    for (const pair of activePairs) {
      try {
        const result = await this.forceCheckSymbol(pair.symbol, pair.interval, pair.marketType);
        totalGapsFilled += result.gapsFilled;
        totalCorruptedFixed += result.corruptedFixed;
      } catch (error) {
        logger.error({ pair, error }, '[repairAll] Error repairing pair');
      }
    }

    return { pairsChecked: activePairs.length, gapsFilled: totalGapsFilled, corruptedFixed: totalCorruptedFixed };
  }

  async getStatusEntries(): Promise<Array<{ symbol: string; interval: string; marketType: string; lastGapCheck: Date | null; lastCorruptionCheck: Date | null; gapsFound: number; corruptedFixed: number; updatedAt: Date }>> {
    const activePairs = await this.getActivePairs();
    if (activePairs.length === 0) return [];

    const results = await Promise.all(
      activePairs.map(async (pair) => {
        const log = await db.query.pairMaintenanceLog.findFirst({
          where: and(
            eq(pairMaintenanceLog.symbol, pair.symbol),
            eq(pairMaintenanceLog.interval, pair.interval),
            eq(pairMaintenanceLog.marketType, pair.marketType)
          ),
        });
        return {
          symbol: pair.symbol,
          interval: pair.interval,
          marketType: pair.marketType,
          lastGapCheck: log?.lastGapCheck ?? null,
          lastCorruptionCheck: log?.lastCorruptionCheck ?? null,
          gapsFound: log?.gapsFound ?? 0,
          corruptedFixed: log?.corruptedFixed ?? 0,
          updatedAt: log?.updatedAt ?? new Date(0),
        };
      })
    );

    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

let klineMaintenanceInstance: KlineMaintenance | null = null;

export const getKlineMaintenance = (): KlineMaintenance => {
  if (!klineMaintenanceInstance) {
    klineMaintenanceInstance = new KlineMaintenance();
  }
  return klineMaintenanceInstance;
};

export const initializeKlineMaintenance = (): KlineMaintenance => {
  klineMaintenanceInstance = new KlineMaintenance();
  return klineMaintenanceInstance;
};

export const getKlineGapFiller = getKlineMaintenance;
export const initializeKlineGapFiller = initializeKlineMaintenance;

export { KlineMaintenance };
export type { ActivePair, GapInfo, KlineMaintenanceStartOptions };
