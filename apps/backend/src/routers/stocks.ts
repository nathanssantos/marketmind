import { z } from 'zod';
import { calculateTieredCommission, type IBAccountType } from '../exchange/interactive-brokers/fee-calculator';
import { marketHoursService } from '../exchange/interactive-brokers/market-hours';
import { shortableChecker } from '../exchange/interactive-brokers/shortable-checker';
import type { ShortabilityInfo } from '../exchange/interactive-brokers/types';
import { logger, serializeError } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const DEFAULT_IB_ACCOUNT_TYPE: IBAccountType = 'PRO';

export type ShortabilityResponse =
  | { known: true; info: ShortabilityInfo }
  | { known: false; reason: string };

export const stocksRouter = router({
  marketStatus: protectedProcedure.query(() => {
    const status = marketHoursService.getMarketStatus();
    return {
      isOpen: status.isOpen,
      sessionType: status.sessionType,
      nextOpen: status.nextOpen?.toISOString() ?? null,
      nextClose: status.nextClose?.toISOString() ?? null,
      isHoliday: status.isHoliday,
      isEarlyClose: status.isEarlyClose,
      earlyCloseTime: status.earlyCloseTime ?? null,
      timezone: 'America/New_York',
    };
  }),

  shortability: protectedProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }): Promise<ShortabilityResponse> => {
      try {
        const info = await shortableChecker.checkShortability(input.symbol);
        return { known: true, info };
      } catch (error) {
        logger.warn({ symbol: input.symbol, error: serializeError(error) }, '[stocks] Shortability unavailable');
        return { known: false, reason: 'Interactive Brokers Gateway is not connected' };
      }
    }),

  commissionEstimate: protectedProcedure
    .input(z.object({
      shares: z.number().positive(),
      price: z.number().positive(),
      accountType: z.enum(['PRO', 'LITE']).default(DEFAULT_IB_ACCOUNT_TYPE),
    }))
    .query(({ input }) => calculateTieredCommission(input.shares, input.price, 0, input.accountType)),
});
