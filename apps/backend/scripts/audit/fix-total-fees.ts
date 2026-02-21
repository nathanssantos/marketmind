import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';

const DRY_RUN = process.argv.includes('--dry-run');

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  FIX TOTAL FEES (fees = entryFee + exitFee)');
  console.log(DRY_RUN ? '  MODE: DRY RUN (no DB changes)' : '  MODE: LIVE (will update DB)');
  console.log('='.repeat(80));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const closedTrades = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.status, 'closed'));

  console.log(`Found ${closedTrades.length} closed trade(s)\n`);

  let corrected = 0;
  let alreadyCorrect = 0;
  const walletPnlDeltas = new Map<string, number>();

  for (const trade of closedTrades) {
    const entryFee = parseFloat(trade.entryFee || '0');
    const exitFee = parseFloat(trade.exitFee || '0');
    const storedFees = parseFloat(trade.fees || '0');
    const expectedFees = entryFee + exitFee;

    if (Math.abs(storedFees - expectedFees) < 0.001) {
      alreadyCorrect++;
      continue;
    }

    const feeDelta = expectedFees - storedFees;

    const entryPrice = parseFloat(trade.entryPrice);
    const exitPrice = parseFloat(trade.exitPrice || '0');
    const quantity = parseFloat(trade.quantity);
    const leverage = trade.leverage || 1;
    const accFunding = parseFloat(trade.accumulatedFunding || '0');

    const grossPnl = trade.side === 'LONG'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;

    const correctedPnl = roundTo(grossPnl - expectedFees + accFunding, 8);
    const marginValue = (entryPrice * quantity) / leverage;
    const correctedPnlPercent = marginValue > 0 ? roundTo((correctedPnl / marginValue) * 100, 4) : 0;

    const oldPnl = parseFloat(trade.pnl || '0');
    const pnlDelta = correctedPnl - oldPnl;

    console.log(`  [${trade.id}] ${trade.symbol} ${trade.side}`);
    console.log(`    fees:       ${storedFees.toFixed(8)} → ${expectedFees.toFixed(8)} (delta=${feeDelta.toFixed(8)})`);
    console.log(`    pnl:        ${oldPnl.toFixed(8)} → ${correctedPnl.toFixed(8)} (delta=${pnlDelta.toFixed(8)})`);
    console.log(`    pnlPercent: ${parseFloat(trade.pnlPercent || '0').toFixed(4)} → ${correctedPnlPercent.toFixed(4)}`);

    if (!DRY_RUN) {
      await db
        .update(tradeExecutions)
        .set({
          fees: expectedFees.toString(),
          pnl: correctedPnl.toString(),
          pnlPercent: correctedPnlPercent.toString(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, trade.id));
    }

    const current = walletPnlDeltas.get(trade.walletId) || 0;
    walletPnlDeltas.set(trade.walletId, current + pnlDelta);
    corrected++;
  }

  console.log('\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total closed trades: ${closedTrades.length}`);
  console.log(`  Already correct:     ${alreadyCorrect}`);
  console.log(`  Corrected:           ${corrected}${DRY_RUN ? ' (dry run)' : ''}`);

  for (const [walletId, pnlDelta] of walletPnlDeltas) {
    if (Math.abs(pnlDelta) < 0.001) continue;

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .limit(1);

    if (!wallet) continue;

    const currentBalance = parseFloat(wallet.currentBalance || '0');
    const newBalance = roundTo(currentBalance + pnlDelta, 8);

    console.log(`\n  WALLET BALANCE ADJUSTMENT (${wallet.name}):`);
    console.log(`    current:  $${currentBalance.toFixed(8)}`);
    console.log(`    pnlDelta: $${pnlDelta.toFixed(8)}`);
    console.log(`    new:      $${newBalance.toFixed(8)}`);

    if (!DRY_RUN) {
      await db
        .update(wallets)
        .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
        .where(and(eq(wallets.id, walletId)));
      console.log(`    Updated`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
