import { USDMClient } from 'binance';
import { db } from '../src/db/client';
import { wallets } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { decryptApiKey } from '../src/services/encryption';

async function main() {
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.id, 'kP_efbmZqtTyEJ4p2LLBx')
  });

  if (!wallet) {
    console.log('Wallet not found');
    process.exit(1);
  }

  console.log('Wallet found:', wallet.name, wallet.walletType);

  if (!wallet.apiKeyEncrypted || !wallet.apiSecretEncrypted) {
    console.log('Wallet has no API keys');
    process.exit(1);
  }

  const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
  const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

  const client = new USDMClient({
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log('Fetching HYPEUSDT orders from Binance...\n');

  const orders = await client.getAllOrders({
    symbol: 'HYPEUSDT',
    limit: 50,
  });

  const relevantOrders = orders.filter(o => {
    const orderTime = new Date(o.time);
    return orderTime >= new Date('2026-01-18') && orderTime <= new Date('2026-01-20');
  });

  console.log(`Found ${relevantOrders.length} HYPEUSDT orders (Jan 18-20, 2026):\n`);

  if (relevantOrders.length === 0) {
    console.log('No orders in date range. Showing last 10 orders:');
    for (const o of orders.slice(-10)) {
      console.log({
        orderId: o.orderId,
        side: o.side,
        type: o.type,
        status: o.status,
        avgPrice: o.avgPrice,
        executedQty: o.executedQty,
        time: new Date(o.time).toISOString(),
        reduceOnly: o.reduceOnly,
      });
      console.log('---');
    }
  }

  for (const o of relevantOrders) {
    console.log({
      orderId: o.orderId,
      side: o.side,
      type: o.type,
      status: o.status,
      price: o.price,
      avgPrice: o.avgPrice,
      origQty: o.origQty,
      executedQty: o.executedQty,
      time: new Date(o.time).toISOString(),
      reduceOnly: o.reduceOnly,
    });
    console.log('---');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
