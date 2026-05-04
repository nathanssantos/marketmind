import 'dotenv/config';
import { db } from '../src/db';
import { wallets } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { createBinanceFuturesClient, getPositions, getConfiguredLeverage } from '../src/services/binance-futures-client';

const main = async () => {
  const walletId = process.argv[2] || 'kP_efbmZqtTyEJ4p2LLBx';
  const symbol = process.argv[3] || 'BTCUSDT';
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.id, walletId) });
  if (!wallet) {
    console.error('wallet not found');
    process.exit(1);
  }
  const client = createBinanceFuturesClient(wallet);

  console.log('--- accountInformationV3.positions[BTCUSDT] ---');
  const acct = await client.getAccountInformationV3();
  const btc = (acct.positions ?? []).filter((p) => p.symbol === symbol);
  console.log(JSON.stringify(btc, null, 2));

  console.log('\n--- getFuturesSymbolConfig (filtered to BTCUSDT) ---');
  const symbolConfig = await client.getFuturesSymbolConfig({ symbol });
  console.log(JSON.stringify(symbolConfig, null, 2));

  console.log('\n--- getFuturesSymbolConfig (no symbol — all) ---');
  const allConfigs = await client.getFuturesSymbolConfig({});
  console.log('count:', allConfigs.length);
  console.log('BTCUSDT entry:', JSON.stringify(allConfigs.find((c) => c.symbol === symbol), null, 2));

  console.log('\n--- getConfiguredLeverage (current impl) ---');
  console.log(await getConfiguredLeverage(client, symbol));

  console.log('\n--- getPositions (open futures, current impl) ---');
  const positions = await getPositions(client);
  console.log(JSON.stringify(positions.filter((p) => p.symbol === symbol), null, 2));

  process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
