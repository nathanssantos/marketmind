import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { getEconomicCalendarService } from '../services/economic-calendar';

export const economicCalendarRouter = router({
  getEvents: publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => {
      const service = getEconomicCalendarService();
      return service.getEvents(input.from, input.to);
    }),
});
