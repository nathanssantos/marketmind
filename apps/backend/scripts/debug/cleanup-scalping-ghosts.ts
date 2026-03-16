import { db } from '../../src/db';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { eq, and, inArray, like } from 'drizzle-orm';
import { cancelFuturesAlgoOrder, createBinanceFuturesClient } from '../../src/services/binance-futures-client';

const main = async () => {
  const ghostExecutions = await db.query.tradeExecutions.findMany({
    where: and(
      inArray(tradeExecutions.status, ['open', 'pending']),
      like(tradeExecutions.setupType, 'scalping-%'),
    ),
  });

  console.log(`Found ${ghostExecutions.length} scalping executions to clean up:\n`);

  if (ghostExecutions.length === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  const walletId = ghostExecutions[0]!.walletId;
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.id, walletId),
  });

  if (!wallet) {
    console.error('Wallet not found');
    process.exit(1);
  }

  const client = createBinanceFuturesClient(wallet);

  for (const exec of ghostExecutions) {
    console.log(`Cleaning: ${exec.id} | ${exec.symbol} ${exec.side} | ${exec.setupType}`);

    const algoIds = [exec.stopLossAlgoId, exec.takeProfitAlgoId].filter(Boolean) as number[];
    for (const algoId of algoIds) {
      try {
        await cancelFuturesAlgoOrder(client, exec.symbol, algoId);
        console.log(`  Cancelled algo order ${algoId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  Algo ${algoId} cancel failed (probably already gone): ${msg}`);
      }
    }

    await db.update(tradeExecutions)
      .set({
        status: 'cancelled',
        closedAt: new Date(),
        exitReason: 'ghost-cleanup',
        updatedAt: new Date(),
      })
      .where(eq(tradeExecutions.id, exec.id));

    console.log(`  Marked as cancelled in DB`);
    console.log();
  }

  console.log('Done. All ghost scalping executions cleaned up.');
  process.exit(0);
};

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
