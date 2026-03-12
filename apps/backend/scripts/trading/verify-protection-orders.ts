import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { tradeExecutions, wallets } from '../../src/db/schema';
import {
  createBinanceFuturesClient,
  getOpenAlgoOrders,
  getPositions,
} from '../../src/services/binance-futures-client';
import { guardedCall } from '../utils/binance-script-guard';

const WALLET_ID = 'kP_efbmZqtTyEJ4p2LLBx';

async function verify() {
  console.log('\n' + '='.repeat(70));
  console.log('  PROTECTION ORDERS VERIFICATION');
  console.log('='.repeat(70) + '\n');

  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) { console.log('Wallet not found'); return; }

  const client = createBinanceFuturesClient(wallet);

  const [dbPositions, exchangeAlgoOrders, exchangePositions] = await Promise.all([
    db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, WALLET_ID),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      ),
    guardedCall(() => getOpenAlgoOrders(client)),
    guardedCall(() => getPositions(client)),
  ]);

  const algoBySymbol = new Map<string, typeof exchangeAlgoOrders>();
  for (const order of exchangeAlgoOrders) {
    const list = algoBySymbol.get(order.symbol) || [];
    list.push(order);
    algoBySymbol.set(order.symbol, list);
  }

  const exchangeSymbols = new Set(exchangePositions.map((p) => p.symbol));

  console.log(`  DB Open: ${dbPositions.length} | Binance Positions: ${exchangePositions.length} | Algo Orders: ${exchangeAlgoOrders.length}\n`);

  const issues: string[] = [];
  const ok: string[] = [];

  for (const pos of dbPositions) {
    const symbolAlgos = algoBySymbol.get(pos.symbol) || [];
    const binanceSL = symbolAlgos.find((o) => o.type === 'STOP_MARKET');
    const binanceTP = symbolAlgos.find((o) => o.type === 'TAKE_PROFIT_MARKET');

    console.log(`  ${pos.symbol} ${pos.side}`);
    console.log(`    DB SL: ${pos.stopLoss || 'NONE'} (algoId: ${pos.stopLossAlgoId || 'NONE'})`);
    console.log(`    DB TP: ${pos.takeProfit || 'NONE'} (algoId: ${pos.takeProfitAlgoId || 'NONE'})`);
    console.log(`    Binance SL: ${binanceSL ? `${binanceSL.triggerPrice} (algo:${binanceSL.algoId})` : 'NONE'}`);
    console.log(`    Binance TP: ${binanceTP ? `${binanceTP.triggerPrice} (algo:${binanceTP.algoId})` : 'NONE'}`);

    let posOk = true;

    if (pos.stopLossAlgoId && !binanceSL) {
      issues.push(`${pos.symbol}: DB has SL algoId ${pos.stopLossAlgoId} but NOT on Binance`);
      posOk = false;
    } else if (pos.stopLossAlgoId && binanceSL && pos.stopLossAlgoId !== binanceSL.algoId) {
      issues.push(`${pos.symbol}: SL algoId mismatch DB=${pos.stopLossAlgoId} vs Binance=${binanceSL.algoId}`);
      posOk = false;
    } else if (!pos.stopLossAlgoId && binanceSL) {
      issues.push(`${pos.symbol}: SL exists on Binance (algo:${binanceSL.algoId}) but DB has no algoId`);
      posOk = false;
    } else if (!pos.stopLoss) {
      issues.push(`${pos.symbol}: NO stop loss at all`);
      posOk = false;
    }

    if (pos.takeProfitAlgoId && !binanceTP) {
      issues.push(`${pos.symbol}: DB has TP algoId ${pos.takeProfitAlgoId} but NOT on Binance`);
      posOk = false;
    } else if (pos.takeProfitAlgoId && binanceTP && pos.takeProfitAlgoId !== binanceTP.algoId) {
      issues.push(`${pos.symbol}: TP algoId mismatch DB=${pos.takeProfitAlgoId} vs Binance=${binanceTP.algoId}`);
      posOk = false;
    } else if (!pos.takeProfitAlgoId && binanceTP) {
      issues.push(`${pos.symbol}: TP exists on Binance (algo:${binanceTP.algoId}) but DB has no algoId`);
      posOk = false;
    } else if (!pos.takeProfit) {
      issues.push(`${pos.symbol}: NO take profit at all`);
      posOk = false;
    }

    if (pos.stopLoss && binanceSL) {
      const dbVal = parseFloat(pos.stopLoss);
      const exchVal = parseFloat(binanceSL.triggerPrice || '0');
      if (Math.abs(dbVal - exchVal) > 0.01) {
        issues.push(`${pos.symbol}: SL price mismatch DB=${dbVal} vs Binance=${exchVal}`);
        posOk = false;
      }
    }

    if (pos.takeProfit && binanceTP) {
      const dbVal = parseFloat(pos.takeProfit);
      const exchVal = parseFloat(binanceTP.triggerPrice || '0');
      if (Math.abs(dbVal - exchVal) > 0.01) {
        issues.push(`${pos.symbol}: TP price mismatch DB=${dbVal} vs Binance=${exchVal}`);
        posOk = false;
      }
    }

    console.log(`    Status: ${posOk ? 'OK' : 'ISSUES'}\n`);
    if (posOk) ok.push(pos.symbol);
  }

  const orphanAlgos = exchangeAlgoOrders.filter((o) => {
    const dbPos = dbPositions.find((p) => p.symbol === o.symbol);
    if (!dbPos) return true;
    if (o.type === 'STOP_MARKET' && dbPos.stopLossAlgoId === o.algoId) return false;
    if (o.type === 'TAKE_PROFIT_MARKET' && dbPos.takeProfitAlgoId === o.algoId) return false;
    return true;
  });

  if (orphanAlgos.length > 0) {
    console.log('  ORPHAN ALGO ORDERS on Binance (not linked to any DB position):');
    for (const o of orphanAlgos) {
      issues.push(`Orphan algo:${o.algoId} ${o.symbol} ${o.type} trigger=${o.triggerPrice}`);
      console.log(`    algo:${o.algoId} ${o.symbol} ${o.side} ${o.type} trigger=${o.triggerPrice}`);
    }
    console.log('');
  }

  console.log('-'.repeat(70));
  if (issues.length === 0) {
    console.log('  ALL PROTECTION ORDERS ARE IN SYNC\n');
  } else {
    console.log(`  ${issues.length} ISSUE(S) FOUND:\n`);
    for (const issue of issues) {
      console.log(`    ! ${issue}`);
    }
    console.log('');
  }

  console.log('='.repeat(70) + '\n');
}

verify()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Fatal error:', err); process.exit(1); });
