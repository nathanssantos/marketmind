import type { TradingSetup } from '@marketmind/types';
import { z } from 'zod';
import { ContextAggregator } from '../services/ai-trading/ContextAggregator';
import { publicProcedure, router } from '../trpc';

export const contextAggregator = new ContextAggregator();

export const aiTradingRouter = router({
  buildContext: publicProcedure
    .input(
      z.object({
        symbol: z.string(),
        detectedSetups: z.array(z.any()).optional(),
      })
    )
    .query(async ({ input }) => {
      const setups = (input.detectedSetups as TradingSetup[]) || [];
      const context = await contextAggregator.buildContext(input.symbol, setups);
      return context;
    }),

  getContextConfig: publicProcedure.query(() => {
    return contextAggregator.getConfig();
  }),

  updateContextConfig: publicProcedure
    .input(
      z.object({
        newsLookbackHours: z.number().optional(),
        eventsLookforwardDays: z.number().optional(),
        enableFearGreedIndex: z.boolean().optional(),
        enableBTCDominance: z.boolean().optional(),
        enableFundingRate: z.boolean().optional(),
        enableOpenInterest: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      contextAggregator.updateConfig(input);
      return { success: true, config: contextAggregator.getConfig() };
    }),
});
