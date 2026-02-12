import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { decryptApiKey } from '../../src/services/encryption';
import { getWalletType } from '../../src/services/binance-client';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const execs = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.status, 'closed'),
        eq(tradeExecutions.marketType, 'FUTURES'),
        isNotNull(tradeExecutions.exitPrice)
      )
    );

  const errorPrefixes = ['exec-1769940', 'exec-1769947', 'exec-1769932', 'exec-1769922'];
  const failing = execs.filter(e => errorPrefixes.some(prefix => e.id.startsWith(prefix)));

  console.log(`Found ${failing.length} failing executions:\n`);
  for (const e of failing) {
    const openedAt = e.openedAt?.getTime() || e.createdAt.getTime();
    const closedAt = e.closedAt?.getTime() || Date.now();
    console.log(`  ${e.id.slice(0, 16)} | ${e.symbol} ${e.side} | opened: ${new Date(openedAt).toISOString()} | closed: ${new Date(closedAt).toISOString()}`);
    console.log(`    entryPrice=${e.entryPrice} exitPrice=${e.exitPrice} qty=${e.quantity}`);
    console.log(`    fees=${e.fees} pnl=${e.pnl} entryFee=${e.entryFee} exitFee=${e.exitFee}`);
    console.log('');
  }

  if (failing.length === 0) {
    console.log('No matching executions found.');
    process.exit(0);
  }

  const walletId = failing[0]!.walletId;
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
  if (!wallet) {
    console.log('No wallet found');
    process.exit(1);
  }

  const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
  const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);
  const walletType = getWalletType(wallet);
  const client = new USDMClient({
    api_key: apiKey,
    api_secret: apiSecret,
    testnet: walletType === 'testnet',
    disableTimeSync: false,
  });

  console.log('Testing Binance API for failing symbols:\n');

  for (const e of failing) {
    const openedAt = e.openedAt?.getTime() || e.createdAt.getTime();
    const closedAt = e.closedAt?.getTime() || Date.now();

    console.log(`  ${e.symbol} (${new Date(openedAt).toISOString()} to ${new Date(closedAt).toISOString()}):`);
    try {
      const trades = await client.getAccountTrades({
        symbol: e.symbol,
        startTime: openedAt - 10_000,
        endTime: closedAt + 10_000,
        limit: 1000,
      });
      console.log(`    OK - ${trades.length} trades found`);
    } catch (error) {
      console.log(`    ERROR type: ${typeof error}`);
      console.log(`    ERROR: ${JSON.stringify(error)}`);
    }
    await sleep(500);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
