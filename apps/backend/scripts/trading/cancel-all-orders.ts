import { db } from '../../src/db/index.js';
import { tradeExecutions, wallets } from '../../src/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { createBinanceFuturesClient, isPaperWallet, cancelAllSymbolOrders } from '../../src/services/binance-futures-client.js';
import { cancelAllOpenProtectionOrdersOnExchange } from '../../src/services/protection-orders.js';
import { guardedCall, checkBan } from '../utils/binance-script-guard.js';

async function main() {
  const openExecs = await db.select().from(tradeExecutions)
    .where(and(eq(tradeExecutions.status, 'open'), eq(tradeExecutions.marketType, 'FUTURES')));

  console.log(`Found ${openExecs.length} open FUTURES execution(s)\n`);

  const walletIds = [...new Set(openExecs.map(e => e.walletId))];

  for (const walletId of walletIds) {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
    if (!wallet || isPaperWallet(wallet)) {
      console.log(`Skipping wallet ${walletId} (paper or not found)`);
      continue;
    }

    const client = createBinanceFuturesClient(wallet);
    const execsForWallet = openExecs.filter(e => e.walletId === walletId);
    const symbols = [...new Set(execsForWallet.map(e => e.symbol))];

    for (const symbol of symbols) {
      console.log(`--- ${symbol} ---`);
      checkBan();

      try {
        await guardedCall(() => cancelAllOpenProtectionOrdersOnExchange({ wallet, symbol, marketType: 'FUTURES' }));
        console.log(`  Cancelled algo/protection orders`);
      } catch (e) {
        console.log(`  Failed to cancel algo orders: ${e}`);
      }

      try {
        await guardedCall(() => cancelAllSymbolOrders(client, symbol));
        console.log(`  Cancelled all regular orders`);
      } catch (e) {
        const msg = String(e);
        if (!msg.includes('No orders')) console.log(`  Failed to cancel regular orders: ${e}`);
      }

      const symbolExecs = execsForWallet.filter(e => e.symbol === symbol);
      for (const exec of symbolExecs) {
        await db.update(tradeExecutions).set({
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
          updatedAt: new Date(),
        }).where(eq(tradeExecutions.id, exec.id));
        console.log(`  DB: cleared SL/TP IDs for execution ${exec.id}`);
      }

      console.log();
    }
  }

  console.log('Done. Positions remain open. Run sync-diagnostic to verify.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
