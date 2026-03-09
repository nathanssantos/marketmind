import 'dotenv/config';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';

const FEE_TOLERANCE = 0.0001;
const DRY_RUN = process.argv.includes('--dry-run');

async function fixFeesCorrectness() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIX FEES CORRECTNESS');
  console.log('  Corrects fees/pnl/pnlPercent for closed executions where');
  console.log('  fees != entryFee + exitFee');
  console.log('='.repeat(70));
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}`);
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const allWallets = await db.select().from(wallets);
  const liveWallets = allWallets.filter((w) => {
    const wType = getWalletType(w);
    return wType !== 'paper' && w.marketType === 'FUTURES';
  });

  if (liveWallets.length === 0) {
    console.log('No live FUTURES wallets found.');
    process.exit(0);
  }

  let totalChecked = 0;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalPnlDelta = 0;

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log('-'.repeat(70));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log('-'.repeat(70));

    const closedExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'closed'),
          eq(tradeExecutions.marketType, 'FUTURES'),
          isNotNull(tradeExecutions.exitPrice)
        )
      );

    console.log(`  Closed executions: ${closedExecutions.length}\n`);

    for (const exec of closedExecutions) {
      totalChecked++;

      const entryFee = parseFloat(exec.entryFee || '0');
      const exitFee = parseFloat(exec.exitFee || '0');
      const storedFees = parseFloat(exec.fees || '0');
      const correctFees = entryFee + exitFee;

      if (Math.abs(storedFees - correctFees) <= FEE_TOLERANCE) {
        continue;
      }

      const entryPrice = parseFloat(exec.entryPrice);
      const exitPrice = parseFloat(exec.exitPrice!);
      const quantity = parseFloat(exec.quantity);
      const leverage = exec.leverage || 1;
      const accumulatedFunding = parseFloat(exec.accumulatedFunding || '0');

      if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
        console.log(`  [SKIP] ${exec.id} ${exec.symbol} — invalid prices/qty`);
        totalSkipped++;
        continue;
      }

      const grossPnl = exec.side === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;

      const oldPnl = parseFloat(exec.pnl || '0');
      const newPnl = grossPnl - correctFees + accumulatedFunding;
      const marginValue = (entryPrice * quantity) / leverage;
      const newPnlPercent = marginValue > 0 ? (newPnl / marginValue) * 100 : 0;

      const pnlDelta = Math.abs(newPnl - oldPnl);
      totalPnlDelta += pnlDelta;

      console.log(`  [FIX] ${exec.symbol} ${exec.side} [${exec.id.slice(0, 12)}]`);
      console.log(`        fees:       ${storedFees.toFixed(8)} → ${correctFees.toFixed(8)}  (entryFee=${entryFee.toFixed(8)} + exitFee=${exitFee.toFixed(8)})`);
      console.log(`        pnl:        ${oldPnl.toFixed(4)} → ${newPnl.toFixed(4)}  (delta: ${(newPnl - oldPnl).toFixed(4)})`);
      console.log(`        pnlPercent: ${parseFloat(exec.pnlPercent || '0').toFixed(2)}% → ${newPnlPercent.toFixed(2)}%\n`);

      if (!DRY_RUN) {
        await db
          .update(tradeExecutions)
          .set({
            fees: correctFees.toString(),
            pnl: newPnl.toString(),
            pnlPercent: newPnlPercent.toString(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, exec.id));
      }

      totalFixed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total checked:  ${totalChecked}`);
  console.log(`  Fixed:          ${totalFixed}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped:        ${totalSkipped}`);
  console.log(`  Total PnL delta: $${totalPnlDelta.toFixed(4)}`);

  if (totalFixed === 0) {
    console.log('\n  All fees are correct. No fixes needed.');
  } else if (DRY_RUN) {
    console.log(`\n  Run without --dry-run to apply ${totalFixed} fix(es).`);
  } else {
    console.log(`\n  ${totalFixed} execution(s) corrected.`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
  process.exit(0);
}

fixFeesCorrectness().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
