import { z } from 'zod';
import { orderSyncService } from '../services/order-sync';
import { protectedProcedure, router } from '../trpc';

export const orderSyncRouter = router({
  syncAll: protectedProcedure
    .input(
      z.object({
        autoCancelOrphans: z.boolean().default(false),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const results = await orderSyncService.runOnce({
        autoCancelOrphans: input?.autoCancelOrphans ?? false,
      });

      const totalOrphans = results.reduce((sum, r) => sum + r.orphanOrders.length, 0);
      const totalMismatched = results.reduce((sum, r) => sum + r.mismatchedOrders.length, 0);
      const totalCancelled = results.reduce((sum, r) => sum + r.cancelledOrphans, 0);
      const errors = results.flatMap((r) => r.errors);

      return {
        success: errors.length === 0,
        walletsChecked: results.length,
        totalOrphanOrders: totalOrphans,
        totalMismatchedOrders: totalMismatched,
        totalCancelledOrphans: totalCancelled,
        results,
        errors,
      };
    }),

  getStatus: protectedProcedure.query(async () => {
    const results = await orderSyncService.runOnce({ autoCancelOrphans: false });

    return {
      walletsChecked: results.length,
      orphanOrders: results.flatMap((r) => r.orphanOrders),
      mismatchedOrders: results.flatMap((r) => r.mismatchedOrders),
      errors: results.flatMap((r) => r.errors),
    };
  }),

  cancelOrphanOrders: protectedProcedure
    .input(
      z.object({
        algoIds: z.array(z.number()).optional(),
      }).optional()
    )
    .mutation(async () => {
      const results = await orderSyncService.runOnce({
        autoCancelOrphans: true,
      });

      const totalCancelled = results.reduce((sum, r) => sum + r.cancelledOrphans, 0);

      return {
        success: true,
        cancelledOrders: totalCancelled,
        results,
      };
    }),
});
