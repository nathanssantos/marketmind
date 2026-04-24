import fs from 'node:fs';
import path from 'node:path';
import { db } from '../../src/db';
import { wallets } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { isPaperWallet } from '../../src/services/binance-client';
import { syncWalletIncome } from '../../src/services/income-events';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PROGRESS_FILE = path.resolve(process.cwd(), '/tmp/backfill-income-progress.json');

interface Progress {
  [walletId: string]: { lastWindowEnd: number; status: 'done' | 'partial' };
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(p: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function main() {
  const all = await db.select().from(wallets).where(eq(wallets.marketType, 'FUTURES'));
  const live = all.filter((w) => !isPaperWallet(w));
  const progress = loadProgress();

  console.log(`[backfill] ${live.length} live FUTURES wallets to backfill`);

  for (const wallet of live) {
    const state = progress[wallet.id];
    if (state?.status === 'done') {
      console.log(`[backfill] ${wallet.name} already done, skipping`);
      continue;
    }

    const createdAt = wallet.createdAt?.getTime() ?? Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const startFrom = state?.lastWindowEnd ?? createdAt;

    console.log(`[backfill] ${wallet.name}: from ${new Date(startFrom).toISOString()} to ${new Date(now).toISOString()}`);

    let cursor = startFrom;
    let windowsProcessed = 0;
    let totalInserted = 0;

    while (cursor < now) {
      const windowEnd = Math.min(cursor + WINDOW_MS, now);
      try {
        const result = await syncWalletIncome(wallet, { startTime: cursor, endTime: windowEnd });
        totalInserted += result.inserted;
        windowsProcessed++;
        console.log(
          `[backfill]   ${wallet.name} window ${new Date(cursor).toISOString().slice(0, 10)} → fetched=${result.fetched} inserted=${result.inserted} linked=${result.linked}`
        );
        progress[wallet.id] = { lastWindowEnd: windowEnd, status: windowEnd >= now ? 'done' : 'partial' };
        saveProgress(progress);
      } catch (e) {
        console.error(`[backfill]   ${wallet.name} window failed:`, e instanceof Error ? e.message : String(e));
        progress[wallet.id] = { lastWindowEnd: cursor, status: 'partial' };
        saveProgress(progress);
        throw e;
      }
      cursor = windowEnd;
      await new Promise((r) => setTimeout(r, 400));
    }

    console.log(`[backfill] ${wallet.name} done: ${windowsProcessed} windows, ${totalInserted} inserted`);
  }

  console.log('[backfill] all wallets complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
