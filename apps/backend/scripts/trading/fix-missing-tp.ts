import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';
import {
  createBinanceFuturesClient,
  getOpenAlgoOrders,
  submitFuturesAlgoOrder,
} from '../../src/services/binance-futures-client';
import { USDMClient } from 'binance';
import { guardedCall, checkBan } from '../utils/binance-script-guard';

const DRY_RUN = process.argv.includes('--dry-run');

function formatPrice(price: number, tickSize: number): string {
  const precision = Math.round(-Math.log10(tickSize));
  return parseFloat(price.toFixed(precision)).toString();
}

function formatQty(qty: number, stepSize: number): string {
  const precision = Math.round(-Math.log10(stepSize));
  return parseFloat(qty.toFixed(precision)).toString();
}

async function getSymbolFilters(client: USDMClient, symbol: string) {
  const info = await guardedCall(() => client.getExchangeInfo());
  const symbolInfo = (info as { symbols: { symbol: string; filters: { filterType: string; tickSize?: string; stepSize?: string }[] }[] }).symbols.find(s => s.symbol === symbol);
  if (!symbolInfo) throw new Error(`Symbol ${symbol} not found`);

  const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
  const lotSize = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');

  const tickSize = parseFloat(priceFilter?.tickSize ?? '0.00001');
  const stepSize = parseFloat(lotSize?.stepSize ?? '1');
  return { tickSize, stepSize };
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  FIX MISSING TP ORDERS');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(70) + '\n');

  const allWallets = await db.select().from(wallets);
  const liveWallets = allWallets.filter(w => {
    const wType = getWalletType(w);
    return wType !== 'paper' && w.apiKeyEncrypted && w.apiSecretEncrypted && w.marketType === 'FUTURES';
  });

  if (liveWallets.length === 0) {
    console.log('No live FUTURES wallets found.');
    process.exit(0);
  }

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);

    const client = createBinanceFuturesClient(wallet);

    const openPositions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    checkBan();
    const algoOrders = await guardedCall(() => getOpenAlgoOrders(client));
    const algoBySymbol = new Map<string, typeof algoOrders>();
    for (const order of algoOrders) {
      const list = algoBySymbol.get(order.symbol) || [];
      list.push(order);
      algoBySymbol.set(order.symbol, list);
    }

    for (const pos of openPositions) {
      if (!pos.takeProfit || !pos.takeProfitAlgoId) continue;

      const symbolAlgos = algoBySymbol.get(pos.symbol) || [];
      const tpOnExchange = symbolAlgos.find(o =>
        (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') &&
        String(o.algoId) === String(pos.takeProfitAlgoId)
      );

      if (tpOnExchange) {
        console.log(`  ${pos.symbol} ${pos.side}: TP already on exchange (algoId=${tpOnExchange.algoId}). Skipping.`);
        continue;
      }

      const tpPrice = parseFloat(pos.takeProfit);
      const qty = parseFloat(pos.quantity);
      const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY';

      console.log(`\n  ${pos.symbol} ${pos.side}: TP missing on exchange`);
      console.log(`    DB TP price: ${tpPrice}`);
      console.log(`    DB TP algoId: ${pos.takeProfitAlgoId} (no longer on exchange)`);
      console.log(`    Qty: ${qty}`);

      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would create TAKE_PROFIT_MARKET ${closeSide} @ ${tpPrice} qty=${qty}`);
        continue;
      }

      const { tickSize, stepSize } = await getSymbolFilters(client as unknown as USDMClient, pos.symbol);
      const formattedPrice = formatPrice(tpPrice, tickSize);
      const formattedQty = formatQty(qty, stepSize);

      console.log(`    Creating TAKE_PROFIT_MARKET ${closeSide} @ ${formattedPrice} qty=${formattedQty}...`);

      const newTpOrder = await guardedCall(() => submitFuturesAlgoOrder(client, {
        symbol: pos.symbol,
        side: closeSide,
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: formattedPrice,
        quantity: formattedQty,
        reduceOnly: true,
        workingType: 'CONTRACT_PRICE',
      }));

      console.log(`    New TP created: algoId=${newTpOrder.algoId}`);

      await db
        .update(tradeExecutions)
        .set({
          takeProfitAlgoId: newTpOrder.algoId,
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, pos.id));

      console.log(`    DB updated with new TP algoId=${newTpOrder.algoId}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  DONE');
  console.log('='.repeat(70) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
