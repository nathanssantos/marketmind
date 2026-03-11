import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import type { USDMClient } from 'binance';
import { db } from '../../src/db';
import { tradeExecutions, wallets, type TradeExecution } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';
import {
  createBinanceFuturesClient,
  getLastClosingTrade,
  getOpenAlgoOrders,
  getOpenOrders,
  getPositions,
} from '../../src/services/binance-futures-client';
import { guardedCall, checkBan } from '../utils/binance-script-guard';

const FIX_FLAG = process.argv.includes('--fix');
const SEPARATOR = '='.repeat(70);
const THIN_SEPARATOR = '-'.repeat(70);

interface SyncIssue {
  symbol: string;
  executionId: string;
  type: 'GHOST_POSITION' | 'MISSING_LOCAL' | 'STALE_SL' | 'STALE_TP' | 'STALE_TRAILING' | 'NO_PROTECTION';
  description: string;
}

interface GhostPositionFix {
  execution: TradeExecution;
  closingTrade: { price: number; realizedPnl: number; commission: number } | null;
}

let openExecutions: TradeExecution[] = [];

async function main() {
  console.log(`\n${SEPARATOR}`);
  console.log('  POSITION SYNC DIAGNOSTIC');
  console.log(`${SEPARATOR}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Mode: ${FIX_FLAG ? 'FIX (will modify DB)' : 'DRY RUN (read-only)'}\n`);

  openExecutions = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.status, 'open'),
        eq(tradeExecutions.marketType, 'FUTURES')
      )
    );

  if (openExecutions.length === 0) {
    console.log('  No open trade executions found in DB. Nothing to sync.\n');
    return;
  }

  console.log(`  Found ${openExecutions.length} open trade execution(s) in DB.\n`);

  const walletIds = [...new Set(openExecutions.map((e) => e.walletId))];

  for (const walletId of walletIds) {
    await processWallet(walletId);
  }

  console.log(`\n${SEPARATOR}`);
  console.log('  SYNC COMPLETE');
  console.log(`${SEPARATOR}\n`);
}

async function processWallet(walletId: string) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

  if (!wallet) {
    console.log(`  Wallet ${walletId} not found in DB. Skipping.\n`);
    return;
  }

  const walletType = getWalletType(wallet);
  if (walletType === 'paper') {
    console.log(`  Wallet "${wallet.name}" is paper. Skipping.\n`);
    return;
  }

  console.log(`${THIN_SEPARATOR}`);
  console.log(`  WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
  console.log(`${THIN_SEPARATOR}\n`);

  let client: USDMClient;
  try {
    client = createBinanceFuturesClient(wallet);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  Failed to create Binance client: ${msg}\n`);
    return;
  }

  const walletExecutions = openExecutions.filter((e) => e.walletId === walletId);

  let exchangePositions: Awaited<ReturnType<typeof getPositions>>;
  let exchangeOrders: Awaited<ReturnType<typeof getOpenOrders>>;
  let exchangeAlgoOrders: Awaited<ReturnType<typeof getOpenAlgoOrders>>;

  try {
    checkBan();
    exchangePositions = await guardedCall(() => getPositions(client));
    exchangeOrders = await guardedCall(() => getOpenOrders(client));
    exchangeAlgoOrders = await guardedCall(() => getOpenAlgoOrders(client));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  Failed to query Binance: ${msg}\n`);
    return;
  }

  console.log(`  Binance Positions: ${exchangePositions.length}`);
  console.log(`  Binance Open Orders: ${exchangeOrders.length}`);
  console.log(`  Binance Algo Orders: ${exchangeAlgoOrders.length}`);
  console.log(`  DB Open Executions: ${walletExecutions.length}\n`);

  const exchangeBySymbol = new Map(exchangePositions.map((p) => [p.symbol, p]));
  const algoBySymbol = new Map<string, typeof exchangeAlgoOrders>();
  for (const order of exchangeAlgoOrders) {
    const list = algoBySymbol.get(order.symbol) || [];
    list.push(order);
    algoBySymbol.set(order.symbol, list);
  }

  const ordersBySymbol = new Map<string, typeof exchangeOrders>();
  for (const order of exchangeOrders) {
    const list = ordersBySymbol.get(order.symbol) || [];
    list.push(order);
    ordersBySymbol.set(order.symbol, list);
  }

  const issues: SyncIssue[] = [];
  const ghostPositions: GhostPositionFix[] = [];

  console.log(`${SEPARATOR}`);
  console.log('  1. POSITION COMPARISON (Local DB vs Binance)');
  console.log(`${SEPARATOR}\n`);

  for (const exec of walletExecutions) {
    const binancePos = exchangeBySymbol.get(exec.symbol);
    const binanceQty = binancePos ? Math.abs(parseFloat(binancePos.positionAmt)) : 0;
    const dbQty = parseFloat(exec.quantity);

    if (!binancePos || binanceQty === 0) {
      console.log(`  ${exec.symbol} ${exec.side}`);
      console.log(`    DB: ${dbQty} @ ${parseFloat(exec.entryPrice).toFixed(4)} (opened: ${exec.openedAt.toISOString()})`);
      console.log(`    Binance: NO POSITION (0 qty)`);
      console.log(`    Status: GHOST (locally open but closed on Binance)\n`);

      issues.push({
        symbol: exec.symbol,
        executionId: exec.id,
        type: 'GHOST_POSITION',
        description: `DB shows open ${exec.side} ${dbQty} but Binance has 0 qty`,
      });

      let closingTrade: { price: number; realizedPnl: number; commission: number } | null = null;
      try {
        closingTrade = await guardedCall(() => getLastClosingTrade(
          client,
          exec.symbol,
          exec.side as 'LONG' | 'SHORT',
          exec.openedAt.getTime()
        ));
      } catch (_err) {
        console.log(`    Could not fetch closing trade from Binance.\n`);
      }

      ghostPositions.push({ execution: exec, closingTrade });
    } else {
      const qtyMatch = Math.abs(binanceQty - dbQty) < 0.00001;
      const status = qtyMatch ? 'OK' : 'QTY_MISMATCH';

      console.log(`  ${exec.symbol} ${exec.side}`);
      console.log(`    DB: ${dbQty} @ ${parseFloat(exec.entryPrice).toFixed(4)}`);
      console.log(`    Binance: ${Math.abs(parseFloat(binancePos.positionAmt))} @ ${parseFloat(binancePos.entryPrice).toFixed(4)}`);
      console.log(`    Status: ${status}\n`);
    }
  }

  const dbSymbols = new Set(walletExecutions.map((e) => e.symbol));
  for (const binancePos of exchangePositions) {
    if (!dbSymbols.has(binancePos.symbol)) {
      const qty = parseFloat(binancePos.positionAmt);
      const side = qty > 0 ? 'LONG' : 'SHORT';
      console.log(`  ${binancePos.symbol} ${side}`);
      console.log(`    DB: NOT FOUND`);
      console.log(`    Binance: ${Math.abs(qty)} @ ${parseFloat(binancePos.entryPrice).toFixed(4)}`);
      console.log(`    Status: MISSING_LOCAL (exists on Binance but not in DB)\n`);

      issues.push({
        symbol: binancePos.symbol,
        executionId: '',
        type: 'MISSING_LOCAL',
        description: `Binance has ${side} ${Math.abs(qty)} but no matching DB execution`,
      });
    }
  }

  console.log(`${SEPARATOR}`);
  console.log('  2. PROTECTION ORDER VERIFICATION');
  console.log(`${SEPARATOR}\n`);

  for (const exec of walletExecutions) {
    const binancePos = exchangeBySymbol.get(exec.symbol);
    if (!binancePos || Math.abs(parseFloat(binancePos.positionAmt)) === 0) continue;

    const symbolAlgos = algoBySymbol.get(exec.symbol) || [];
    const symbolOrders = ordersBySymbol.get(exec.symbol) || [];

    let hasIssue = false;

    if (exec.stopLossAlgoId) {
      const found = symbolAlgos.find((o) => o.algoId === exec.stopLossAlgoId);
      if (!found) {
        console.log(`  ${exec.symbol}: SL algo:${exec.stopLossAlgoId} in DB but NOT on Binance`);
        issues.push({
          symbol: exec.symbol,
          executionId: exec.id,
          type: 'STALE_SL',
          description: `SL algo:${exec.stopLossAlgoId} not found on Binance`,
        });
        hasIssue = true;
      } else {
        const dbSL = exec.stopLoss ? parseFloat(exec.stopLoss) : 0;
        const exchSL = parseFloat(found.triggerPrice || '0');
        if (Math.abs(dbSL - exchSL) > 0.01) {
          console.log(`  ${exec.symbol}: SL price mismatch DB=${dbSL} vs Binance=${exchSL}`);
          hasIssue = true;
        }
      }
    } else if (exec.stopLossOrderId) {
      const found = symbolOrders.find((o) => o.orderId === exec.stopLossOrderId);
      if (!found) {
        console.log(`  ${exec.symbol}: SL order:${exec.stopLossOrderId} in DB but NOT on Binance`);
        issues.push({
          symbol: exec.symbol,
          executionId: exec.id,
          type: 'STALE_SL',
          description: `SL order:${exec.stopLossOrderId} not found on Binance`,
        });
        hasIssue = true;
      }
    } else if (!exec.stopLoss) {
      console.log(`  ${exec.symbol}: NO stop loss defined`);
      issues.push({
        symbol: exec.symbol,
        executionId: exec.id,
        type: 'NO_PROTECTION',
        description: 'No stop loss defined at all',
      });
      hasIssue = true;
    }

    if (exec.takeProfitAlgoId) {
      const found = symbolAlgos.find((o) => o.algoId === exec.takeProfitAlgoId);
      if (!found) {
        console.log(`  ${exec.symbol}: TP algo:${exec.takeProfitAlgoId} in DB but NOT on Binance`);
        issues.push({
          symbol: exec.symbol,
          executionId: exec.id,
          type: 'STALE_TP',
          description: `TP algo:${exec.takeProfitAlgoId} not found on Binance`,
        });
        hasIssue = true;
      } else {
        const dbTP = exec.takeProfit ? parseFloat(exec.takeProfit) : 0;
        const exchTP = parseFloat(found.triggerPrice || '0');
        if (Math.abs(dbTP - exchTP) > 0.01) {
          console.log(`  ${exec.symbol}: TP price mismatch DB=${dbTP} vs Binance=${exchTP}`);
          hasIssue = true;
        }
      }
    } else if (exec.takeProfitOrderId) {
      const found = symbolOrders.find((o) => o.orderId === exec.takeProfitOrderId);
      if (!found) {
        console.log(`  ${exec.symbol}: TP order:${exec.takeProfitOrderId} in DB but NOT on Binance`);
        issues.push({
          symbol: exec.symbol,
          executionId: exec.id,
          type: 'STALE_TP',
          description: `TP order:${exec.takeProfitOrderId} not found on Binance`,
        });
        hasIssue = true;
      }
    }

    if (exec.trailingStopAlgoId) {
      const found = symbolAlgos.find((o) => o.algoId === exec.trailingStopAlgoId);
      if (!found) {
        console.log(`  ${exec.symbol}: Trailing algo:${exec.trailingStopAlgoId} in DB but NOT on Binance`);
        issues.push({
          symbol: exec.symbol,
          executionId: exec.id,
          type: 'STALE_TRAILING',
          description: `Trailing algo:${exec.trailingStopAlgoId} not found on Binance`,
        });
        hasIssue = true;
      }
    }

    if (!hasIssue) {
      console.log(`  ${exec.symbol}: Protection orders OK`);
    }
  }

  console.log(`\n${SEPARATOR}`);
  console.log('  3. SUMMARY & RECOMMENDATIONS');
  console.log(`${SEPARATOR}\n`);

  if (issues.length === 0) {
    console.log('  All positions and protection orders are in sync.\n');
    return;
  }

  console.log(`  ${issues.length} issue(s) found:\n`);

  const ghostIssues = issues.filter((i) => i.type === 'GHOST_POSITION');
  const missingLocalIssues = issues.filter((i) => i.type === 'MISSING_LOCAL');
  const staleIssues = issues.filter((i) =>
    i.type === 'STALE_SL' || i.type === 'STALE_TP' || i.type === 'STALE_TRAILING'
  );
  const noProtectionIssues = issues.filter((i) => i.type === 'NO_PROTECTION');

  if (ghostIssues.length > 0) {
    console.log(`  GHOST POSITIONS (${ghostIssues.length}):`);
    console.log('  These are locally "open" but have 0 qty on Binance.');
    console.log('  Recommendation: Close them in DB with PnL from Binance trades.\n');
    for (const ghost of ghostPositions) {
      const exec = ghost.execution;
      console.log(`    ${exec.symbol} ${exec.side} qty=${exec.quantity}`);
      if (ghost.closingTrade) {
        console.log(`      Exit price: ${ghost.closingTrade.price.toFixed(4)}`);
        console.log(`      Realized PnL: ${ghost.closingTrade.realizedPnl.toFixed(4)} USDT`);
        console.log(`      Commission: ${ghost.closingTrade.commission.toFixed(4)} USDT`);
      } else {
        console.log('      No closing trade data found on Binance.');
      }
      console.log('');
    }
  }

  if (missingLocalIssues.length > 0) {
    console.log(`  MISSING LOCAL (${missingLocalIssues.length}):`);
    console.log('  Positions exist on Binance but not in local DB.');
    console.log('  Recommendation: Manually investigate. These may be from manual trades.\n');
    for (const issue of missingLocalIssues) {
      console.log(`    ${issue.symbol}: ${issue.description}`);
    }
    console.log('');
  }

  if (staleIssues.length > 0) {
    console.log(`  STALE PROTECTION ORDERS (${staleIssues.length}):`);
    console.log('  DB references order IDs that no longer exist on Binance.');
    console.log('  Recommendation: Re-place protection orders or update DB references.\n');
    for (const issue of staleIssues) {
      console.log(`    ${issue.symbol}: ${issue.description}`);
    }
    console.log('');
  }

  if (noProtectionIssues.length > 0) {
    console.log(`  UNPROTECTED POSITIONS (${noProtectionIssues.length}):`);
    console.log('  Positions with no stop loss at all.');
    console.log('  Recommendation: Place protection orders immediately.\n');
    for (const issue of noProtectionIssues) {
      console.log(`    ${issue.symbol}: ${issue.description}`);
    }
    console.log('');
  }

  if (FIX_FLAG) {
    await applyFixes(ghostPositions, staleIssues);
  } else if (ghostIssues.length > 0) {
    console.log(`  Run with --fix to close ${ghostIssues.length} ghost position(s) in DB.\n`);
  }
}

async function applyFixes(
  ghostPositions: GhostPositionFix[],
  staleIssues: SyncIssue[]
) {
  console.log(`${SEPARATOR}`);
  console.log('  4. APPLYING FIXES');
  console.log(`${SEPARATOR}\n`);

  if (ghostPositions.length > 0) {
    console.log(`  Closing ${ghostPositions.length} ghost position(s) in DB...\n`);

    for (const ghost of ghostPositions) {
      const exec = ghost.execution;
      const now = new Date();

      const exitPrice = ghost.closingTrade?.price
        ? String(ghost.closingTrade.price)
        : null;
      const pnl = ghost.closingTrade?.realizedPnl
        ? String(ghost.closingTrade.realizedPnl)
        : null;
      const fees = ghost.closingTrade?.commission
        ? String(ghost.closingTrade.commission)
        : null;

      const entryPrice = parseFloat(exec.entryPrice);
      const exitPriceNum = ghost.closingTrade?.price || 0;
      const pnlPercent = entryPrice > 0 && exitPriceNum > 0
        ? exec.side === 'LONG'
          ? String(((exitPriceNum - entryPrice) / entryPrice) * 100)
          : String(((entryPrice - exitPriceNum) / entryPrice) * 100)
        : null;

      try {
        await db
          .update(tradeExecutions)
          .set({
            status: 'closed',
            closedAt: now,
            exitPrice,
            pnl,
            pnlPercent,
            fees,
            exitSource: 'sync-script',
            exitReason: 'ghost-position-sync',
            updatedAt: now,
          })
          .where(eq(tradeExecutions.id, exec.id));

        console.log(`    ${exec.symbol} ${exec.side}: CLOSED`);
        if (pnl) console.log(`      PnL: ${parseFloat(pnl).toFixed(4)} USDT (${pnlPercent ? parseFloat(pnlPercent).toFixed(2) : '?'}%)`);
        if (fees) console.log(`      Fees: ${parseFloat(fees).toFixed(4)} USDT`);
        console.log('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    ${exec.symbol}: FAILED to update - ${msg}\n`);
      }
    }
  }

  if (staleIssues.length > 0) {
    console.log('  Stale protection orders (logged only, no auto-fix):');
    console.log('  These need manual intervention to re-place orders on Binance.\n');
    for (const issue of staleIssues) {
      console.log(`    ${issue.symbol} [${issue.executionId.slice(0, 8)}]: ${issue.description}`);
    }
    console.log('');
  }

  console.log('  Fixes applied.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
