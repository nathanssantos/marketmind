import { calculateTotalFees } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { tradeExecutions, wallets } from '../src/db/schema';

interface FeeAuditResult {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  marketType: 'SPOT' | 'FUTURES';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  storedFees: number;
  expectedFees: number;
  discrepancy: number;
  storedPnl: number;
  expectedPnl: number;
  corrected: boolean;
}

const DISCREPANCY_THRESHOLD = 0.01;

const auditAndCorrectFees = async (): Promise<FeeAuditResult[]> => {
  console.log('🔍 MarketMind Paper Trading Fees Audit');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const paperWallets = await db.query.wallets.findMany({
    where: eq(wallets.walletType, 'paper'),
  });

  if (paperWallets.length === 0) {
    console.log('No paper trading wallets found.');
    return [];
  }

  console.log(`Found ${paperWallets.length} paper trading wallet(s)`);
  const paperWalletIds = paperWallets.map(w => w.id);

  const trades = await db.query.tradeExecutions.findMany({
    where: and(
      eq(tradeExecutions.status, 'closed'),
    ),
  });

  const paperTrades = trades.filter(t => paperWalletIds.includes(t.walletId));

  console.log(`Found ${paperTrades.length} closed paper trading trade(s)\n`);

  if (paperTrades.length === 0) {
    console.log('No trades to audit.');
    return [];
  }

  const results: FeeAuditResult[] = [];
  let correctedCount = 0;
  let totalDiscrepancy = 0;

  for (const trade of paperTrades) {
    if (!trade.exitPrice) continue;

    const entryPrice = parseFloat(trade.entryPrice);
    const exitPrice = parseFloat(trade.exitPrice);
    const quantity = parseFloat(trade.quantity);
    const storedFees = trade.fees ? parseFloat(trade.fees) : 0;
    const storedPnl = trade.pnl ? parseFloat(trade.pnl) : 0;
    const marketType = (trade.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT') as 'SPOT' | 'FUTURES';

    const entryValue = entryPrice * quantity;
    const exitValue = exitPrice * quantity;

    const { totalFees: expectedFees } = calculateTotalFees(entryValue, exitValue, {
      marketType,
      useBnbDiscount: false,
      vipLevel: 0,
    });

    let grossPnl = 0;
    if (trade.side === 'LONG') {
      grossPnl = (exitPrice - entryPrice) * quantity;
    } else {
      grossPnl = (entryPrice - exitPrice) * quantity;
    }
    const expectedPnl = grossPnl - expectedFees;

    const discrepancy = Math.abs(storedFees - expectedFees);
    const pnlDiscrepancy = Math.abs(storedPnl - expectedPnl);

    if (discrepancy > DISCREPANCY_THRESHOLD || pnlDiscrepancy > DISCREPANCY_THRESHOLD) {
      console.log(`⚠️  Discrepancy found in trade ${trade.id}:`);
      console.log(`   Symbol: ${trade.symbol} (${trade.side})`);
      console.log(`   Market Type: ${marketType}`);
      console.log(`   Entry: ${entryPrice} | Exit: ${exitPrice} | Qty: ${quantity}`);
      console.log(`   Fees: stored=${storedFees.toFixed(8)} expected=${expectedFees.toFixed(8)} diff=${discrepancy.toFixed(8)}`);
      console.log(`   PnL: stored=${storedPnl.toFixed(8)} expected=${expectedPnl.toFixed(8)} diff=${pnlDiscrepancy.toFixed(8)}`);

      const leverage = trade.leverage ?? 1;
      const marginValue = entryValue / leverage;
      const newPnlPercent = (expectedPnl / marginValue) * 100;

      await db.update(tradeExecutions)
        .set({
          fees: expectedFees.toString(),
          pnl: expectedPnl.toString(),
          pnlPercent: newPnlPercent.toString(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, trade.id));

      console.log(`   ✅ Corrected: fees=${expectedFees.toFixed(8)}, pnl=${expectedPnl.toFixed(8)}, pnlPercent=${newPnlPercent.toFixed(2)}%\n`);

      results.push({
        tradeId: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        marketType,
        entryPrice,
        exitPrice,
        quantity,
        storedFees,
        expectedFees,
        discrepancy,
        storedPnl,
        expectedPnl,
        corrected: true,
      });

      correctedCount++;
      totalDiscrepancy += discrepancy;
    }
  }

  console.log('='.repeat(70));
  console.log('Audit Summary:');
  console.log(`  Total trades audited: ${paperTrades.length}`);
  console.log(`  Discrepancies found: ${results.length}`);
  console.log(`  Trades corrected: ${correctedCount}`);
  console.log(`  Total fee discrepancy: $${totalDiscrepancy.toFixed(8)}`);

  if (results.length === 0) {
    console.log('\n✅ All paper trading fees are correct!');
  } else {
    console.log(`\n✅ Corrected ${correctedCount} trade(s) with fee discrepancies`);
  }
  console.log('='.repeat(70));

  return results;
};

const main = async () => {
  try {
    await auditAndCorrectFees();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during audit:', error);
    process.exit(1);
  }
};

main();
