import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { decryptApiKey } from '../../src/services/encryption';
import { getWalletType } from '../../src/services/binance-client';
import { guardedCall, checkBan } from '../utils/binance-script-guard';

const PNL_TOLERANCE = 0.05;
const DRY_RUN = process.argv.includes('--dry-run');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000 - 60_000;

async function fetchFundingFees(
  client: USDMClient,
  symbol: string,
  startTime: number,
  endTime: number
): Promise<number> {
  let totalFunding = 0;
  let windowStart = startTime;

  while (windowStart < endTime) {
    const windowEnd = Math.min(windowStart + SEVEN_DAYS_MS, endTime);
    let currentStart = windowStart;

    while (currentStart < windowEnd) {
      const income = await guardedCall(() => client.getIncomeHistory({
        symbol,
        incomeType: 'FUNDING_FEE',
        startTime: currentStart,
        endTime: windowEnd,
        limit: 1000,
      } as Parameters<typeof client.getIncomeHistory>[0]));

      if (income.length === 0) break;
      for (const item of income) totalFunding += parseFloat(item.income);
      if (income.length < 1000) break;
      currentStart = income[income.length - 1]!.time + 1;
    }

    windowStart = windowEnd + 1;
  }

  return totalFunding;
}

async function fixPnlFunding() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIX PNL FUNDING');
  console.log('  Corrects accumulatedFunding/pnl/pnlPercent for closed executions');
  console.log('  by fetching actual funding fees from Binance income history.');
  console.log('='.repeat(70));
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will update DB)'}`)
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const allWallets = await db.select().from(wallets);
  const liveWallets = allWallets.filter(w => {
    const wType = getWalletType(w);
    return wType !== 'paper' && w.apiKeyEncrypted && w.apiSecretEncrypted && w.marketType === 'FUTURES';
  });

  if (liveWallets.length === 0) {
    console.log('No live FUTURES wallets found.');
    process.exit(0);
  }

  let totalChecked = 0;
  let totalFixed = 0;
  let totalSkipped = 0;

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log('-'.repeat(70));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log('-'.repeat(70));

    const apiKey = decryptApiKey(wallet.apiKeyEncrypted!);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted!);
    const client = new USDMClient({
      api_key: apiKey,
      api_secret: apiSecret,
      testnet: walletType === 'testnet',
      disableTimeSync: false,
    });

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

      const entryPrice = parseFloat(exec.entryPrice);
      const exitPrice = parseFloat(exec.exitPrice!);
      const quantity = parseFloat(exec.quantity);
      const leverage = exec.leverage || 1;
      const fees = parseFloat(exec.fees || '0');
      const oldPnl = parseFloat(exec.pnl || '0');
      const oldFunding = parseFloat(exec.accumulatedFunding || '0');

      if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
        totalSkipped++;
        continue;
      }

      const openedAt = exec.openedAt?.getTime() || exec.createdAt.getTime();
      const closedAt = exec.closedAt?.getTime() || Date.now();

      let binanceFunding: number;
      try {
        checkBan();
        binanceFunding = await fetchFundingFees(client, exec.symbol, openedAt, closedAt);
      } catch (err) {
        console.log(`  [SKIP] ${exec.id} ${exec.symbol} — failed to fetch funding: ${err}`);
        totalSkipped++;
        continue;
      }

      const grossPnl = exec.side === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;

      const newPnl = grossPnl - fees + binanceFunding;
      const marginValue = (entryPrice * quantity) / leverage;
      const newPnlPercent = marginValue > 0 ? (newPnl / marginValue) * 100 : 0;

      const pnlDiff = Math.abs(newPnl - oldPnl);
      const fundingDiff = Math.abs(binanceFunding - oldFunding);

      if (pnlDiff <= PNL_TOLERANCE && fundingDiff <= 0.001) continue;

      console.log(`  [FIX] ${exec.symbol} ${exec.side} [${exec.id.slice(0, 12)}]`);
      console.log(`        funding: ${oldFunding.toFixed(8)} → ${binanceFunding.toFixed(8)}`);
      console.log(`        pnl:     ${oldPnl.toFixed(4)} → ${newPnl.toFixed(4)}  (delta: ${(newPnl - oldPnl).toFixed(4)})`);
      console.log(`        pnl%:    ${parseFloat(exec.pnlPercent || '0').toFixed(2)}% → ${newPnlPercent.toFixed(2)}%\n`);

      if (!DRY_RUN) {
        await db
          .update(tradeExecutions)
          .set({
            accumulatedFunding: binanceFunding.toString(),
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
  console.log(`  Total checked: ${totalChecked}`);
  console.log(`  Fixed:         ${totalFixed}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped:       ${totalSkipped}`);

  if (totalFixed === 0) {
    console.log('\n  All funding values are correct. No fixes needed.');
  } else if (DRY_RUN) {
    console.log(`\n  Run without --dry-run to apply ${totalFixed} fix(es).`);
  } else {
    console.log(`\n  ${totalFixed} execution(s) corrected.`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
  process.exit(0);
}

fixPnlFunding().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
