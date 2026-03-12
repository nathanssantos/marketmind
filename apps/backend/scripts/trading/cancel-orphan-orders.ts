import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets } from '../../src/db/schema';
import { createBinanceFuturesClient, cancelFuturesAlgoOrder } from '../../src/services/binance-futures-client';

const WALLET_ID = 'kP_efbmZqtTyEJ4p2LLBx';

const ORPHAN_ALGO_IDS = [
  4000000860362752,
  4000000860362144,
  4000000860362064,
  4000000860361994,
  4000000860361924,
  4000000860361856,
  4000000860111622,
  4000000859722909,
];

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) {
    console.log('Wallet not found');
    return;
  }
  const client = createBinanceFuturesClient(wallet);

  for (const algoId of ORPHAN_ALGO_IDS) {
    await new Promise(r => setTimeout(r, 1200));
    try {
      await cancelFuturesAlgoOrder(client, algoId);
      console.log(`Cancelled algo:${algoId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found') || msg.includes('Unknown') || msg.includes('does not exist')) {
        console.log(`Already gone algo:${algoId}`);
      } else {
        console.log(`FAILED algo:${algoId} — ${msg}`);
      }
    }
  }

  console.log('\nDone. Set SL/TP for KITE and NIGHT via the UI.');
  process.exit(0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
