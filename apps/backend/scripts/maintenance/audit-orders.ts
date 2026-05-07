import 'dotenv/config';
import { eq, and, inArray, ne } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets, orders } from '../../src/db/schema';
import { createBinanceFuturesClient } from '../../src/services/binance-futures-client';
import { getOpenOrders, getOpenAlgoOrders } from '../../src/services/binance-futures-orders';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) {
    console.error('No wallet');
    process.exit(1);
  }

  const client = createBinanceFuturesClient(wallet);

  console.log('=== BINANCE OPEN ORDERS (regular) ===');
  const binanceOrders = await getOpenOrders(client);
  for (const o of binanceOrders) {
    console.log({
      orderId: String(o.orderId),
      symbol: o.symbol, side: o.side, type: o.type, status: o.status,
      price: o.price, stopPrice: o.stopPrice, origQty: o.origQty, reduceOnly: o.reduceOnly,
    });
  }
  if (binanceOrders.length === 0) console.log('(none)');

  console.log('\n=== BINANCE OPEN ALGO ORDERS (SL/TP STOP_MARKET) ===');
  const binanceAlgos = await getOpenAlgoOrders(client);
  for (const a of binanceAlgos) {
    console.log({
      algoId: String(a.algoId), symbol: a.symbol, side: a.side, type: a.type, status: a.algoStatus,
      triggerPrice: a.triggerPrice, quantity: a.quantity, reduceOnly: a.reduceOnly,
    });
  }
  if (binanceAlgos.length === 0) console.log('(none)');

  console.log('\n=== DB ORDERS WITH STATUS NEW (potentially stale) ===');
  const dbOrders = await db.select().from(orders)
    .where(and(eq(orders.walletId, WALLET_ID), ne(orders.status, 'FILLED'), ne(orders.status, 'CANCELED'), ne(orders.status, 'EXPIRED')));
  const binanceIds = new Set([
    ...binanceOrders.map((o) => String(o.orderId)),
    ...binanceAlgos.map((a) => String(a.algoId)),
  ]);
  const stale: string[] = [];
  for (const o of dbOrders) {
    const live = binanceIds.has(String(o.orderId));
    console.log({
      orderId: o.orderId, type: o.type, side: o.side, price: o.price, origQty: o.origQty,
      status: o.status, liveOnBinance: live,
    });
    if (!live) stale.push(o.orderId);
  }
  console.log('\nDB orders not present on Binance (stale):', stale.length);
  for (const id of stale) console.log('  -', id);

  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
