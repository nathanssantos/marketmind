import 'dotenv/config';
import { eq, and, gte, lte, ne } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets, tradeExecutions } from '../../src/db/schema';
import { createBinanceFuturesClient } from '../../src/services/binance-futures-client';
import { guardBinanceCall } from '../../src/services/binance-api-cache';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';
const APPLY = process.argv.includes('--apply');

interface IncomeEntry {
  symbol?: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  tranId?: number;
  tradeId?: number;
}

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) {
    console.error('No wallet');
    process.exit(1);
  }

  const client = createBinanceFuturesClient(wallet);

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const startTime = startOfDayUtc.getTime();
  const endTime = Date.now();

  console.log(`Audit window: ${new Date(startTime).toISOString()} → ${new Date(endTime).toISOString()}`);
  console.log(`Wallet: ${WALLET_ID}\n`);

  // ----- Binance income for today -----
  console.log('=== BINANCE INCOME (today) ===');
  const incomes = (await guardBinanceCall(() =>
    client.getIncomeHistory({ startTime, endTime, limit: 1000 } as never),
  )) as IncomeEntry[];

  const totalsByType: Record<string, number> = {};
  const realizedPnlBySymbol: Record<string, number> = {};
  let totalRealized = 0;
  let totalFees = 0;
  let totalFunding = 0;

  for (const inc of incomes) {
    const amt = parseFloat(inc.income);
    totalsByType[inc.incomeType] = (totalsByType[inc.incomeType] ?? 0) + amt;
    if (inc.incomeType === 'REALIZED_PNL' && inc.symbol) {
      realizedPnlBySymbol[inc.symbol] = (realizedPnlBySymbol[inc.symbol] ?? 0) + amt;
      totalRealized += amt;
    }
    if (inc.incomeType === 'COMMISSION') totalFees += amt;
    if (inc.incomeType === 'FUNDING_FEE') totalFunding += amt;
  }

  console.log('Income breakdown:', totalsByType);
  console.log('Realized PnL by symbol:', realizedPnlBySymbol);
  console.log(`Total realized: ${totalRealized.toFixed(4)}`);
  console.log(`Total fees: ${totalFees.toFixed(4)}`);
  console.log(`Total funding: ${totalFunding.toFixed(4)}`);
  console.log(`NET (realized + fees + funding): ${(totalRealized + totalFees + totalFunding).toFixed(4)}`);

  // ----- DB closed execs today -----
  console.log('\n=== DB CLOSED EXECS (today) ===');
  const dbClosed = await db.select().from(tradeExecutions).where(
    and(
      eq(tradeExecutions.walletId, WALLET_ID),
      eq(tradeExecutions.status, 'closed'),
      gte(tradeExecutions.closedAt, new Date(startTime)),
      lte(tradeExecutions.closedAt, new Date(endTime)),
    ),
  );

  let dbPnlTotal = 0;
  let dbFeesTotal = 0;
  const dbPnlBySymbol: Record<string, number> = {};
  for (const e of dbClosed) {
    const pnl = parseFloat(e.pnl ?? '0');
    const fees = parseFloat(e.fees ?? '0');
    dbPnlTotal += pnl;
    dbFeesTotal += fees;
    dbPnlBySymbol[e.symbol] = (dbPnlBySymbol[e.symbol] ?? 0) + pnl;
  }

  console.log(`DB closed execs: ${dbClosed.length}`);
  console.log('DB pnl by symbol:', dbPnlBySymbol);
  console.log(`DB total pnl: ${dbPnlTotal.toFixed(4)}`);
  console.log(`DB total fees: ${dbFeesTotal.toFixed(4)}`);

  // ----- Diff (NET vs NET) -----
  // DB exec.pnl is already net of fees; Binance gives gross realized in
  // REALIZED_PNL income type, so subtract commission + funding to compare
  // apples to apples. Cross-day artifacts (exec opened yesterday + closed
  // today) inflate today's DB fees → remaining drift is expected to be
  // small and conceptually-correct from the per-exec POV.
  console.log('\n=== DIFF (NET vs NET) ===');
  const binanceNet = totalRealized + totalFees + totalFunding;
  const dbNet = dbPnlTotal;
  const netDrift = dbNet - binanceNet;
  console.log(`Binance net (today): ${binanceNet.toFixed(4)}`);
  console.log(`DB net (today):      ${dbNet.toFixed(4)}`);
  console.log(`Net drift:           ${netDrift.toFixed(4)}${Math.abs(netDrift) > 1 ? '  ⚠ DRIFT' : '  ok'}`);

  // ----- DB closed execs missing fields -----
  console.log('\n=== DB CLOSED EXECS WITH MISSING FIELDS ===');
  const incomplete = dbClosed.filter(
    (e) => !e.pnl || !e.exitPrice || parseFloat(e.exitPrice) === 0,
  );
  for (const e of incomplete) {
    console.log({
      id: e.id, symbol: e.symbol, side: e.side, entryPrice: e.entryPrice,
      exitPrice: e.exitPrice, pnl: e.pnl, exitReason: e.exitReason, closedAt: e.closedAt,
    });
  }
  console.log(`Total incomplete: ${incomplete.length}`);

  // ----- DB open/pending execs that have no live position on Binance -----
  console.log('\n=== ORPHAN OPEN/PENDING EXECS (no live Binance position) ===');
  const dbActive = await db.select().from(tradeExecutions).where(
    and(eq(tradeExecutions.walletId, WALLET_ID), ne(tradeExecutions.status, 'closed'), ne(tradeExecutions.status, 'cancelled')),
  );
  // Get current Binance positions
  const { getPositions } = await import('../../src/services/binance-futures-client');
  const positions = await getPositions(client);
  const livePositionSymbols = new Set(
    positions.filter((p) => Math.abs(parseFloat(String(p.positionAmt))) > 0).map((p) => p.symbol),
  );
  const orphanActive = dbActive.filter((e) => !livePositionSymbols.has(e.symbol));
  for (const e of orphanActive) {
    console.log({
      id: e.id, symbol: e.symbol, side: e.side, status: e.status,
      entryPrice: e.entryPrice, quantity: e.quantity, openedAt: e.openedAt,
    });
  }
  console.log(`Total orphan active: ${orphanActive.length}`);

  if (!APPLY) {
    console.log('\n(read-only mode — pass --apply to fix)');
    process.exit(0);
  }

  console.log('\n=== APPLYING FIXES ===');

  // Close orphan open/pending execs
  if (orphanActive.length > 0) {
    for (const e of orphanActive) {
      const symbolPnl = realizedPnlBySymbol[e.symbol] ?? 0;
      // Best-effort: attribute the symbol's leftover realized PnL minus what's
      // already booked in DB for that symbol. If multiple orphans for the same
      // symbol, split is ambiguous — only auto-fix when there's a single orphan.
      const sameSymbolOrphans = orphanActive.filter((x) => x.symbol === e.symbol);
      const dbBookedForSymbol = dbPnlBySymbol[e.symbol] ?? 0;
      const remainingPnl = symbolPnl - dbBookedForSymbol;
      const attributedPnl = sameSymbolOrphans.length === 1 ? remainingPnl : 0;

      await db.update(tradeExecutions).set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
        pnl: attributedPnl.toString(),
        exitReason: 'STALE_RECONCILED',
        exitSource: 'BINANCE_RECONCILE',
      }).where(eq(tradeExecutions.id, e.id));

      console.log(`  closed ${e.id} (${e.symbol} ${e.side}) attributedPnl=${attributedPnl.toFixed(4)}`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
