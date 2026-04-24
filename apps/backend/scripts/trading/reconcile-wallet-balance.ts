import { db } from '../../src/db';
import { incomeEvents, wallets } from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isPaperWallet } from '../../src/services/binance-client';
import { createBinanceFuturesClient, getAccountInfo } from '../../src/services/binance-futures-client';

const APPLY = process.argv.includes('--apply');

interface WalletDelta {
  walletName: string;
  walletId: string;
  initialBalance: number;
  sumIncome: number;
  expected: number;
  binanceBalance: number | null;
  dbBalance: number;
  binanceDelta: number | null;
  dbDelta: number;
}

async function main() {
  const all = await db.select().from(wallets).where(eq(wallets.marketType, 'FUTURES'));
  const live = all.filter((w) => !isPaperWallet(w));

  const deltas: WalletDelta[] = [];

  for (const wallet of live) {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)` })
      .from(incomeEvents)
      .where(eq(incomeEvents.walletId, wallet.id));

    const sumIncome = parseFloat(row?.total ?? '0');
    const initialBalance = parseFloat(wallet.initialBalance ?? '0');
    const dbBalance = parseFloat(wallet.currentBalance ?? '0');

    const expected = initialBalance + sumIncome;

    let binanceBalance: number | null = null;
    try {
      const client = createBinanceFuturesClient(wallet);
      const info = await getAccountInfo(client);
      const usdt = info.assets?.find((a) => a.asset === 'USDT');
      binanceBalance = usdt ? parseFloat(String(usdt.walletBalance)) : null;
    } catch (e) {
      console.error(`[reconcile] ${wallet.name}: failed to fetch Binance balance:`, e instanceof Error ? e.message : String(e));
    }

    const delta: WalletDelta = {
      walletName: wallet.name,
      walletId: wallet.id,
      initialBalance,
      sumIncome,
      expected,
      binanceBalance,
      dbBalance,
      binanceDelta: binanceBalance !== null ? binanceBalance - expected : null,
      dbDelta: dbBalance - expected,
    };
    deltas.push(delta);

    console.log(`\n[reconcile] ${wallet.name} (${wallet.id})`);
    console.log(`  initial=${initialBalance.toFixed(2)} sumIncome=${sumIncome.toFixed(2)} expected=${expected.toFixed(2)}`);
    if (binanceBalance !== null) {
      console.log(`  binance=${binanceBalance.toFixed(2)} delta=${(binanceBalance - expected).toFixed(2)}`);
    }
    console.log(`  db=${dbBalance.toFixed(2)} delta=${(dbBalance - expected).toFixed(2)}`);

    if (APPLY && binanceBalance !== null && Math.abs(dbBalance - binanceBalance) > 0.01) {
      await db
        .update(wallets)
        .set({ currentBalance: binanceBalance.toString(), updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));
      console.log(`  [APPLIED] updated db balance to ${binanceBalance.toFixed(2)}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const d of deltas) {
    const flag = d.binanceDelta !== null && Math.abs(d.binanceDelta) > 0.01 ? 'MISMATCH' : 'OK';
    console.log(`  [${flag}] ${d.walletName}: binanceΔ=${d.binanceDelta?.toFixed(2) ?? 'N/A'} dbΔ=${d.dbDelta.toFixed(2)}`);
  }

  if (!APPLY) console.log('\n[reconcile] dry-run. Use --apply to write fixes to DB.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[reconcile] fatal:', err);
  process.exit(1);
});
