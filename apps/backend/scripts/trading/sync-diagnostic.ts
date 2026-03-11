import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';
import {
  createBinanceFuturesClient,
  getAccountInfo,
  getOpenAlgoOrders,
  getOpenOrders,
  getPositions,
} from '../../src/services/binance-futures-client';
import { guardedCall, checkBan } from '../utils/binance-script-guard';

async function syncDiagnostic() {
  console.log('\n' + '='.repeat(70));
  console.log('  BINANCE FUTURES SYNC DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const allWallets = await db.select().from(wallets);
  const futuresWallets = allWallets.filter(
    (w) => w.marketType === 'FUTURES' && w.apiKeyEncrypted && w.apiSecretEncrypted
  );

  if (futuresWallets.length === 0) {
    console.log('No FUTURES wallets with API keys found.');
    return;
  }

  for (const wallet of futuresWallets) {
    const walletType = getWalletType(wallet);
    if (walletType === 'paper') {
      console.log(`Skipping paper wallet: ${wallet.name}`);
      continue;
    }

    console.log('-'.repeat(70));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log(`DB Balance: ${wallet.currentBalance || '0'} USDT`);
    console.log('-'.repeat(70));

    try {
      const client = createBinanceFuturesClient(wallet);

      checkBan();
      const exchangePositions = await guardedCall(() => getPositions(client));
      const exchangeOrders = await guardedCall(() => getOpenOrders(client));
      const exchangeAlgoOrders = await guardedCall(() => getOpenAlgoOrders(client));
      const accountInfo = await guardedCall(() => getAccountInfo(client));
      const dbOpenPositions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, wallet.id),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        );
      const dbPendingPositions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, wallet.id),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        );

      console.log(`\nBinance Wallet Balance: ${accountInfo.totalWalletBalance} USDT`);
      console.log(`Binance Available: ${accountInfo.availableBalance} USDT`);
      console.log(`Binance Unrealized PnL: ${accountInfo.totalUnrealizedProfit} USDT`);

      console.log('\n' + '='.repeat(70));
      console.log('  1. POSITIONS COMPARISON');
      console.log('='.repeat(70));

      console.log(`\n  Binance: ${exchangePositions.length} open position(s)`);
      console.log(`  DB Open: ${dbOpenPositions.length} position(s)`);
      console.log(`  DB Pending: ${dbPendingPositions.length} order(s)`);

      const exchangeBySymbol = new Map(exchangePositions.map((p) => [p.symbol, p]));
      const dbBySymbol = new Map(dbOpenPositions.map((p) => [p.symbol, p]));

      const allSymbols = new Set([...exchangeBySymbol.keys(), ...dbBySymbol.keys()]);

      if (allSymbols.size > 0) {
        console.log('\n  %-12s  %-6s  %-15s  %-15s  %-10s', 'SYMBOL', 'SIDE', 'BINANCE QTY', 'DB QTY', 'STATUS');
        console.log('  ' + '-'.repeat(65));
      }

      const positionIssues: string[] = [];

      for (const symbol of [...allSymbols].sort()) {
        const exchange = exchangeBySymbol.get(symbol);
        const local = dbBySymbol.get(symbol);

        const exchangeQty = exchange ? parseFloat(exchange.positionAmt) : 0;
        const exchangeSide = exchangeQty > 0 ? 'LONG' : exchangeQty < 0 ? 'SHORT' : '-';
        const dbQty = local ? parseFloat(local.quantity) : 0;
        const dbSide = local?.side || '-';

        let status = '';
        if (exchange && local) {
          const qtyMatch = Math.abs(Math.abs(exchangeQty) - dbQty) < 0.00001;
          const sideMatch = exchangeSide === dbSide;
          if (qtyMatch && sideMatch) {
            status = 'OK';
          } else {
            status = 'MISMATCH';
            if (!qtyMatch) positionIssues.push(`${symbol}: qty differs (binance=${Math.abs(exchangeQty)}, db=${dbQty})`);
            if (!sideMatch) positionIssues.push(`${symbol}: side differs (binance=${exchangeSide}, db=${dbSide})`);
          }
        } else if (exchange && !local) {
          status = 'ONLY BINANCE';
          positionIssues.push(`${symbol}: position on Binance (${exchangeSide} ${Math.abs(exchangeQty)}) but NOT in DB`);
        } else if (!exchange && local) {
          status = 'ONLY DB';
          positionIssues.push(`${symbol}: position in DB (${dbSide} ${dbQty}) but NOT on Binance`);
        }

        console.log(
          '  %-12s  %-6s  %-15s  %-15s  %-10s',
          symbol,
          exchange ? exchangeSide : dbSide,
          exchange ? `${Math.abs(exchangeQty)} @ ${parseFloat(exchange.entryPrice).toFixed(4)}` : '-',
          local ? `${dbQty} @ ${parseFloat(local.entryPrice).toFixed(4)}` : '-',
          status
        );
      }

      if (positionIssues.length === 0 && allSymbols.size > 0) {
        console.log('\n  All positions are in sync.');
      } else if (positionIssues.length > 0) {
        console.log('\n  ISSUES FOUND:');
        for (const issue of positionIssues) {
          console.log(`    ! ${issue}`);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('  2. REGULAR OPEN ORDERS (LIMIT, STOP, etc.)');
      console.log('='.repeat(70));

      if (exchangeOrders.length === 0) {
        console.log('\n  No regular open orders on Binance.');
      } else {
        console.log(`\n  ${exchangeOrders.length} regular order(s) on Binance:\n`);
        for (const order of exchangeOrders) {
          const price = parseFloat(order.price) > 0 ? order.price : order.stopPrice;
          console.log(
            '    [%d] %s %s %s qty=%s price=%s status=%s',
            order.orderId,
            order.symbol,
            order.side,
            order.type,
            order.origQty,
            price,
            order.status
          );
        }
      }

      const dbEntryOrderIds = new Set(
        [...dbOpenPositions, ...dbPendingPositions]
          .filter((p) => p.entryOrderId)
          .map((p) => p.entryOrderId!)
      );
      const dbExitOrderIds = new Set(
        dbOpenPositions.filter((p) => p.exitOrderId).map((p) => p.exitOrderId!)
      );
      const dbSLOrderIds = new Set(
        dbOpenPositions.filter((p) => p.stopLossOrderId).map((p) => p.stopLossOrderId!)
      );
      const dbTPOrderIds = new Set(
        dbOpenPositions.filter((p) => p.takeProfitOrderId).map((p) => p.takeProfitOrderId!)
      );
      const allDbOrderIds = new Set([...dbEntryOrderIds, ...dbExitOrderIds, ...dbSLOrderIds, ...dbTPOrderIds]);

      const orphanRegularOrders = exchangeOrders.filter((o) => !allDbOrderIds.has(o.orderId));
      if (orphanRegularOrders.length > 0) {
        console.log(`\n  ORPHAN ORDERS (on Binance but not in DB): ${orphanRegularOrders.length}`);
        for (const order of orphanRegularOrders) {
          console.log(
            '    ! [%d] %s %s %s qty=%s',
            order.orderId,
            order.symbol,
            order.side,
            order.type,
            order.origQty
          );
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('  3. ALGO ORDERS (STOP_MARKET, TAKE_PROFIT_MARKET)');
      console.log('='.repeat(70));

      if (exchangeAlgoOrders.length === 0) {
        console.log('\n  No algo orders on Binance.');
      } else {
        console.log(`\n  ${exchangeAlgoOrders.length} algo order(s) on Binance:\n`);
        for (const order of exchangeAlgoOrders) {
          console.log(
            '    [algo:%d] %s %s %s qty=%s trigger=%s',
            order.algoId,
            order.symbol,
            order.side,
            order.type,
            order.quantity,
            order.triggerPrice || '-'
          );
        }
      }

      const dbSLAlgoIds = new Set(
        dbOpenPositions.filter((p) => p.stopLossAlgoId).map((p) => p.stopLossAlgoId!)
      );
      const dbTPAlgoIds = new Set(
        dbOpenPositions.filter((p) => p.takeProfitAlgoId).map((p) => p.takeProfitAlgoId!)
      );
      const dbTrailingAlgoIds = new Set(
        dbOpenPositions.filter((p) => p.trailingStopAlgoId).map((p) => p.trailingStopAlgoId!)
      );
      const allDbAlgoIds = new Set([...dbSLAlgoIds, ...dbTPAlgoIds, ...dbTrailingAlgoIds]);

      const orphanAlgoOrders = exchangeAlgoOrders.filter((o) => !allDbAlgoIds.has(o.algoId));
      if (orphanAlgoOrders.length > 0) {
        console.log(`\n  ORPHAN ALGO ORDERS (on Binance but not in DB): ${orphanAlgoOrders.length}`);
        for (const order of orphanAlgoOrders) {
          console.log(
            '    ! [algo:%d] %s %s %s trigger=%s',
            order.algoId,
            order.symbol,
            order.side,
            order.type,
            order.triggerPrice || '-'
          );
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('  4. DB PROTECTION ORDERS vs BINANCE');
      console.log('='.repeat(70));

      const protectionIssues: string[] = [];

      for (const pos of dbOpenPositions) {
        const symbolAlgoOrders = exchangeAlgoOrders.filter((o) => o.symbol === pos.symbol);

        if (pos.stopLossAlgoId) {
          const found = symbolAlgoOrders.find((o) => o.algoId === pos.stopLossAlgoId);
          if (!found) {
            protectionIssues.push(
              `${pos.symbol} SL algo:${pos.stopLossAlgoId} in DB but NOT on Binance (may have been filled/cancelled)`
            );
          } else {
            const dbSL = pos.stopLoss ? parseFloat(pos.stopLoss) : 0;
            const exchSL = parseFloat(found.triggerPrice || '0');
            if (Math.abs(dbSL - exchSL) > 0.01) {
              protectionIssues.push(
                `${pos.symbol} SL price mismatch: DB=${dbSL}, Binance=${exchSL}`
              );
            }
          }
        }

        if (pos.takeProfitAlgoId) {
          const found = symbolAlgoOrders.find((o) => o.algoId === pos.takeProfitAlgoId);
          if (!found) {
            protectionIssues.push(
              `${pos.symbol} TP algo:${pos.takeProfitAlgoId} in DB but NOT on Binance (may have been filled/cancelled)`
            );
          } else {
            const dbTP = pos.takeProfit ? parseFloat(pos.takeProfit) : 0;
            const exchTP = parseFloat(found.triggerPrice || '0');
            if (Math.abs(dbTP - exchTP) > 0.01) {
              protectionIssues.push(
                `${pos.symbol} TP price mismatch: DB=${dbTP}, Binance=${exchTP}`
              );
            }
          }
        }

        if (pos.stopLoss && !pos.stopLossAlgoId && !pos.stopLossOrderId) {
          protectionIssues.push(
            `${pos.symbol} has SL=${pos.stopLoss} in DB but no order ID (local-only SL)`
          );
        }

        if (pos.takeProfit && !pos.takeProfitAlgoId && !pos.takeProfitOrderId) {
          protectionIssues.push(
            `${pos.symbol} has TP=${pos.takeProfit} in DB but no order ID (local-only TP)`
          );
        }

        if (!pos.stopLoss && !pos.takeProfit) {
          protectionIssues.push(`${pos.symbol} has NO protection orders at all`);
        }
      }

      if (protectionIssues.length === 0) {
        console.log('\n  All protection orders match.');
      } else {
        console.log(`\n  ${protectionIssues.length} issue(s) found:\n`);
        for (const issue of protectionIssues) {
          console.log(`    ! ${issue}`);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('  5. PENDING ORDERS IN DB');
      console.log('='.repeat(70));

      if (dbPendingPositions.length === 0) {
        console.log('\n  No pending orders in DB.');
      } else {
        console.log(`\n  ${dbPendingPositions.length} pending order(s):\n`);
        for (const pos of dbPendingPositions) {
          const isExpired = pos.expiresAt && pos.expiresAt < new Date();
          console.log(
            '    [%s] %s %s limit=%s expires=%s %s',
            pos.id.slice(0, 8),
            pos.symbol,
            pos.side,
            pos.limitEntryPrice || '-',
            pos.expiresAt?.toISOString() || 'never',
            isExpired ? '(EXPIRED)' : ''
          );

          if (pos.entryOrderId) {
            const matchingExchangeOrder = exchangeOrders.find((o) => o.orderId === pos.entryOrderId);
            if (!matchingExchangeOrder) {
              console.log(
                '      ! Entry order %d NOT found on Binance',
                pos.entryOrderId
              );
            } else {
              console.log(
                '      Entry order %d found on Binance: %s',
                pos.entryOrderId,
                matchingExchangeOrder.status
              );
            }
          }
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('  6. BALANCE COMPARISON');
      console.log('='.repeat(70));

      const dbBalance = parseFloat(wallet.currentBalance || '0');
      const binanceBalance = parseFloat(accountInfo.totalWalletBalance);
      const balanceDiff = Math.abs(dbBalance - binanceBalance);

      console.log(`\n  DB Balance:      ${dbBalance.toFixed(4)} USDT`);
      console.log(`  Binance Balance: ${binanceBalance.toFixed(4)} USDT`);
      console.log(`  Difference:      ${balanceDiff.toFixed(4)} USDT`);

      if (balanceDiff > 1) {
        console.log('  ! Balance is out of sync (diff > $1)');
      } else {
        console.log('  Balance looks OK.');
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`\n  ERROR connecting to Binance: ${msg}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  DIAGNOSTIC COMPLETE');
  console.log('='.repeat(70) + '\n');
}

syncDiagnostic()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
