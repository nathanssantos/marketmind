import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';
import {
  createBinanceFuturesClient,
  cancelFuturesAlgoOrder,
  getOpenAlgoOrders,
  submitFuturesAlgoOrder,
} from '../../src/services/binance-futures-client';
import type { USDMClient } from 'binance';

const DRY_RUN = process.argv.includes('--dry-run');

async function getSymbolFilters(client: USDMClient, symbol: string) {
  const info = await client.getExchangeInfo();
  const symbolInfo = (info as { symbols: { symbol: string; filters: { filterType: string; tickSize?: string; stepSize?: string }[] }[] }).symbols.find(s => s.symbol === symbol);
  if (!symbolInfo) throw new Error(`Symbol ${symbol} not found`);
  const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
  const lotSize = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
  const tickSize = parseFloat(priceFilter?.tickSize ?? '0.00001');
  const stepSize = parseFloat(lotSize?.stepSize ?? '1');
  return { tickSize, stepSize };
}

function formatPrice(price: number, tickSize: number): string {
  const precision = Math.round(-Math.log10(tickSize));
  return parseFloat(price.toFixed(precision)).toString();
}

function formatQty(qty: number, stepSize: number): string {
  const precision = Math.round(-Math.log10(stepSize));
  return parseFloat(qty.toFixed(precision)).toString();
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  ALIGN PROTECTION ORDERS');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
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
    console.log(`\nWALLET: ${wallet.name} (${wallet.id})\n`);
    const client = createBinanceFuturesClient(wallet);

    const [openPositions, exchangeAlgos] = await Promise.all([
      db.select().from(tradeExecutions).where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      ),
      getOpenAlgoOrders(client),
    ]);

    console.log(`  DB open positions: ${openPositions.length}`);
    console.log(`  Binance algo orders: ${exchangeAlgos.length}\n`);

    const validAlgoIds = new Set<number>();
    for (const pos of openPositions) {
      if (pos.stopLossAlgoId) validAlgoIds.add(pos.stopLossAlgoId);
      if (pos.takeProfitAlgoId) validAlgoIds.add(pos.takeProfitAlgoId);
    }

    // ── Step 1: Cancel orphan algo orders ────────────────────────────
    const orphans = exchangeAlgos.filter(o => !validAlgoIds.has(o.algoId));

    if (orphans.length === 0) {
      console.log('  No orphan algo orders found.');
    } else {
      console.log(`  Found ${orphans.length} orphan algo order(s):\n`);
      for (const o of orphans) {
        console.log(`    algoId:${o.algoId}  ${o.symbol}  ${o.type}  trigger=${o.triggerPrice ?? '—'}`);
        if (!DRY_RUN) {
          await cancelFuturesAlgoOrder(client, o.algoId);
          console.log(`    → Cancelled`);
        } else {
          console.log(`    → [DRY RUN] Would cancel`);
        }
      }
    }

    // ── Step 2: Re-place missing SL/TP for each open position ─────────
    console.log('\n  Checking SL/TP coverage for each open position...\n');

    const algoBySymbol = new Map<string, typeof exchangeAlgos>();
    for (const o of exchangeAlgos) {
      if (!validAlgoIds.has(o.algoId)) continue; // skip orphans we just cancelled
      const list = algoBySymbol.get(o.symbol) ?? [];
      list.push(o);
      algoBySymbol.set(o.symbol, list);
    }

    for (const pos of openPositions) {
      const symbolAlgos = algoBySymbol.get(pos.symbol) ?? [];
      const slOnExchange = symbolAlgos.find(o => o.algoId === pos.stopLossAlgoId);
      const tpOnExchange = symbolAlgos.find(o => o.algoId === pos.takeProfitAlgoId);
      const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
      const qty = parseFloat(pos.quantity);

      let slAlgoId = pos.stopLossAlgoId;
      let tpAlgoId = pos.takeProfitAlgoId;
      let changed = false;

      console.log(`  ${pos.symbol} ${pos.side}  qty=${qty}  entry=${pos.entryPrice}`);
      console.log(`    SL: DB=${pos.stopLoss ?? 'NONE'} (algo:${pos.stopLossAlgoId ?? 'NONE'}) | Exchange: ${slOnExchange ? `algo:${slOnExchange.algoId} @ ${slOnExchange.triggerPrice}` : 'MISSING'}`);
      console.log(`    TP: DB=${pos.takeProfit ?? 'NONE'} (algo:${pos.takeProfitAlgoId ?? 'NONE'}) | Exchange: ${tpOnExchange ? `algo:${tpOnExchange.algoId} @ ${tpOnExchange.triggerPrice}` : 'MISSING'}`);

      const { tickSize, stepSize } = await getSymbolFilters(client as unknown as USDMClient, pos.symbol);

      if (pos.stopLoss && !slOnExchange) {
        const price = formatPrice(parseFloat(pos.stopLoss), tickSize);
        const formattedQty = formatQty(qty, stepSize);
        console.log(`    → SL missing on exchange — placing STOP_MARKET ${closeSide} @ ${price} qty=${formattedQty}`);
        if (!DRY_RUN) {
          const result = await submitFuturesAlgoOrder(client, {
            symbol: pos.symbol,
            side: closeSide,
            type: 'STOP_MARKET',
            triggerPrice: price,
            quantity: formattedQty,
            reduceOnly: true,
            workingType: 'CONTRACT_PRICE',
          });
          slAlgoId = result.algoId;
          changed = true;
          console.log(`    → New SL algoId: ${slAlgoId}`);
        } else {
          console.log(`    → [DRY RUN] Would create SL`);
        }
      }

      if (pos.takeProfit && !tpOnExchange) {
        const price = formatPrice(parseFloat(pos.takeProfit), tickSize);
        const formattedQty = formatQty(qty, stepSize);
        console.log(`    → TP missing on exchange — placing TAKE_PROFIT_MARKET ${closeSide} @ ${price} qty=${formattedQty}`);
        if (!DRY_RUN) {
          const result = await submitFuturesAlgoOrder(client, {
            symbol: pos.symbol,
            side: closeSide,
            type: 'TAKE_PROFIT_MARKET',
            triggerPrice: price,
            quantity: formattedQty,
            reduceOnly: true,
            workingType: 'CONTRACT_PRICE',
          });
          tpAlgoId = result.algoId;
          changed = true;
          console.log(`    → New TP algoId: ${tpAlgoId}`);
        } else {
          console.log(`    → [DRY RUN] Would create TP`);
        }
      }

      if (changed && !DRY_RUN) {
        await db.update(tradeExecutions).set({
          stopLossAlgoId: slAlgoId,
          takeProfitAlgoId: tpAlgoId,
          stopLossIsAlgo: slAlgoId != null ? true : pos.stopLossIsAlgo,
          takeProfitIsAlgo: tpAlgoId != null ? true : pos.takeProfitIsAlgo,
          updatedAt: new Date(),
        }).where(eq(tradeExecutions.id, pos.id));
        console.log(`    → DB updated`);
      }

      if (!pos.stopLoss) console.log(`    ! Position has no SL price in DB — skipping SL creation`);
      if (!pos.takeProfit) console.log(`    ! Position has no TP price in DB — skipping TP creation`);

      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('  DONE');
  console.log('='.repeat(70) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
