import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { tradeExecutions, wallets } from '../../src/db/schema';
import {
  createBinanceFuturesClient,
  getAccountInfo,
  getAllTradeFeesForPosition,
  isPaperWallet,
} from '../../src/services/binance-futures-client';
import { calculatePnl } from '@marketmind/utils';

// One-shot reconciliation:
//   1. For each live wallet, set `currentBalance` = Binance totalWalletBalance.
//   2. For each execution closed via SYNC/ORPHANED_POSITION, re-fetch fees
//      with the new orderId-scoped logic and recompute pnl + fees on the row.
//
// Step 1 is the source-of-truth fix: Binance's totalWalletBalance reflects
// every realized PnL minus every actual fee, so trusting it makes the local
// `currentBalance` match the exchange exactly (regardless of how wrong our
// per-execution math was).
//
// Step 2 is cosmetic: it makes the historical execution rows look right too,
// so the PnL chart and analytics don't show inflated losses on orphan rows.

const reconcile = async () => {
  console.log('Starting wallet reconciliation...\n');

  const allWallets = await db.select().from(wallets);
  if (allWallets.length === 0) {
    console.log('No wallets found.');
    process.exit(0);
  }

  for (const wallet of allWallets) {
    if (isPaperWallet(wallet)) {
      console.log(`Skipping paper wallet: ${wallet.name}`);
      continue;
    }

    console.log(`\n=== ${wallet.name} (${wallet.id}) ===`);
    console.log(`  Local currentBalance: ${wallet.currentBalance} ${wallet.currency}`);

    const client = createBinanceFuturesClient(wallet);

    try {
      const account = await getAccountInfo(client);
      const newBalance = account.totalWalletBalance;
      console.log(`  Binance totalWalletBalance: ${newBalance} USDT`);

      const delta = parseFloat(newBalance) - parseFloat(wallet.currentBalance ?? '0');
      console.log(`  Delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(4)} USDT`);

      await db.update(wallets)
        .set({ currentBalance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));
      console.log('  ✓ wallet.currentBalance synced to Binance');
    } catch (e) {
      console.error(`  ✗ failed to sync wallet:`, (e as Error).message);
      continue;
    }

    // Step 2: recompute fees + pnl for orphan-closed executions.
    const orphans = await db
      .select()
      .from(tradeExecutions)
      .where(and(
        eq(tradeExecutions.walletId, wallet.id),
        eq(tradeExecutions.status, 'closed'),
        eq(tradeExecutions.exitReason, 'ORPHANED_POSITION'),
      ));

    console.log(`  ${orphans.length} orphan-closed execution(s) to recompute`);

    for (const exec of orphans) {
      try {
        const openedAt = exec.openedAt?.getTime() ?? exec.createdAt.getTime();
        const closedAt = exec.closedAt?.getTime();

        const realFees = await getAllTradeFeesForPosition(
          client,
          exec.symbol,
          exec.side,
          openedAt,
          closedAt,
          exec.entryOrderId,
          exec.exitOrderId,
        );

        if (!realFees) {
          console.log(`  - ${exec.id}: no Binance trades found, skipping`);
          continue;
        }

        const entryPrice = parseFloat(exec.entryPrice);
        const exitPrice = realFees.exitPrice > 0
          ? realFees.exitPrice
          : parseFloat(exec.exitPrice ?? exec.entryPrice);
        const quantity = parseFloat(exec.quantity);
        const leverage = exec.leverage ?? 1;
        const accumulatedFunding = parseFloat(exec.accumulatedFunding ?? '0');

        const newPnl = calculatePnl({
          entryPrice,
          exitPrice,
          quantity,
          side: exec.side,
          marketType: 'FUTURES',
          leverage,
          accumulatedFunding,
          entryFee: realFees.entryFee,
          exitFee: realFees.exitFee,
        });

        const oldPnl = parseFloat(exec.pnl ?? '0');
        const oldFees = parseFloat(exec.fees ?? '0');

        await db.update(tradeExecutions)
          .set({
            entryFee: realFees.entryFee.toString(),
            exitFee: realFees.exitFee.toString(),
            fees: newPnl.totalFees.toString(),
            pnl: newPnl.netPnl.toString(),
            pnlPercent: newPnl.pnlPercent.toString(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, exec.id));

        console.log(`  - ${exec.id} (${exec.symbol} ${exec.side}):`);
        console.log(`      pnl ${oldPnl.toFixed(4)} → ${newPnl.netPnl.toFixed(4)} USDT`);
        console.log(`      fees ${oldFees.toFixed(4)} → ${newPnl.totalFees.toFixed(4)} USDT`);
      } catch (e) {
        console.error(`  - ${exec.id}: failed to recompute:`, (e as Error).message);
      }
    }
  }

  console.log('\n✓ Reconciliation complete.');
  process.exit(0);
};

reconcile().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
