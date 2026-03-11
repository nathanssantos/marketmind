import { db } from '../../src/db/index.js';
import { tradeExecutions, wallets } from '../../src/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { createBinanceFuturesClient, isPaperWallet, getPosition, closePosition, cancelAllSymbolOrders } from '../../src/services/binance-futures-client.js';
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
        console.log(`  Cancelled protection orders`);
      } catch (e) {
        console.log(`  Failed to cancel protection orders: ${e}`);
      }

      try {
        await guardedCall(() => cancelAllSymbolOrders(client, symbol));
        console.log(`  Cancelled all remaining orders`);
      } catch (e) {
        const msg = String(e);
        if (!msg.includes('No orders')) console.log(`  Failed to cancel orders: ${e}`);
      }

      try {
        const pos = await guardedCall(() => getPosition(client, symbol));
        if (pos) {
          const posAmt = parseFloat(String(pos.positionAmt));
          if (posAmt !== 0) {
            await guardedCall(() => closePosition(client, symbol, String(posAmt)));
            console.log(`  Closed position: ${posAmt} @ market`);
          } else {
            console.log(`  No position on exchange`);
          }
        }
      } catch (e) {
        console.log(`  Failed to close position: ${e}`);
      }

      const symbolExecs = execsForWallet.filter(e => e.symbol === symbol);
      for (const exec of symbolExecs) {
        await db.update(tradeExecutions).set({
          status: 'closed',
          exitSource: 'MANUAL',
          exitReason: 'MANUAL_CLOSE',
          closedAt: new Date(),
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
        }).where(and(eq(tradeExecutions.id, exec.id), eq(tradeExecutions.status, 'open')));
        console.log(`  DB: closed execution ${exec.id}`);
      }

      console.log();
    }
  }

  console.log('Done. Run sync-diagnostic to verify.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
