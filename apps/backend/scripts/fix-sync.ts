import { and, eq, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { tradeExecutions, wallets } from '../src/db/schema';
import { getWalletType } from '../src/services/binance-client';
import {
  createBinanceFuturesClient,
  getAccountInfo,
  getOpenAlgoOrders,
  getPositions,
  getAllTradeFeesForPosition,
  getLastClosingTrade,
  getRecentTrades,
} from '../src/services/binance-futures-client';

const WALLET_ID = 'kP_efbmZqtTyEJ4p2LLBx';

async function fixSync() {
  console.log('\n' + '='.repeat(70));
  console.log('  SYNC FIX SCRIPT');
  console.log('='.repeat(70) + '\n');

  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) {
    console.log('Wallet not found');
    return;
  }

  const client = createBinanceFuturesClient(wallet);

  console.log('1. FIXING ICPUSDT (in DB but not on Binance)\n');

  const [icpPosition] = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, WALLET_ID),
        eq(tradeExecutions.symbol, 'ICPUSDT'),
        eq(tradeExecutions.status, 'open')
      )
    )
    .limit(1);

  if (icpPosition) {
    console.log(`  Found: ${icpPosition.id}`);
    console.log(`  Side: ${icpPosition.side}, Entry: ${icpPosition.entryPrice}, Qty: ${icpPosition.quantity}`);
    console.log(`  SL Algo: ${icpPosition.stopLossAlgoId}, TP Algo: ${icpPosition.takeProfitAlgoId}`);

    const openedAt = icpPosition.openedAt?.getTime() || icpPosition.createdAt.getTime();
    let exitPrice = 0;
    let entryFee = parseFloat(icpPosition.entryFee || '0');
    let exitFee = 0;
    let totalFees = entryFee;
    let realizedPnl = 0;

    const allFees = await getAllTradeFeesForPosition(client, 'ICPUSDT', icpPosition.side, openedAt);

    if (allFees) {
      exitPrice = allFees.exitPrice;
      entryFee = allFees.entryFee;
      exitFee = allFees.exitFee;
      totalFees = allFees.totalFees;
      realizedPnl = allFees.realizedPnl;
      console.log(`\n  Binance trade data found:`);
      console.log(`    Exit Price: ${exitPrice}`);
      console.log(`    Entry Fee: ${entryFee}`);
      console.log(`    Exit Fee: ${exitFee}`);
      console.log(`    Total Fees: ${totalFees}`);
      console.log(`    Realized PnL: ${realizedPnl}`);
    } else {
      const closingTrade = await getLastClosingTrade(client, 'ICPUSDT', icpPosition.side, openedAt);
      if (closingTrade) {
        exitPrice = closingTrade.price;
        exitFee = closingTrade.commission;
        totalFees = entryFee + exitFee;
        realizedPnl = closingTrade.realizedPnl;
        console.log(`\n  Binance closing trade found (fallback):`);
        console.log(`    Exit Price: ${exitPrice}`);
        console.log(`    Exit Fee: ${exitFee}`);
        console.log(`    Realized PnL: ${realizedPnl}`);
      } else {
        console.log('\n  No trade data found on Binance. Fetching recent trades...');
        const recentTrades = await getRecentTrades(client, 'ICPUSDT', 50);
        const closingSide = icpPosition.side === 'LONG' ? 'SELL' : 'BUY';
        const closingTrades = recentTrades.filter(
          (t) => t.side === closingSide && parseFloat(t.realizedPnl) !== 0
        );

        if (closingTrades.length > 0) {
          let weightedPrice = 0;
          let totalQty = 0;
          for (const trade of closingTrades) {
            const qty = parseFloat(trade.qty);
            const price = parseFloat(trade.price);
            weightedPrice += price * qty;
            totalQty += qty;
            exitFee += parseFloat(trade.commission);
            realizedPnl += parseFloat(trade.realizedPnl);
          }
          exitPrice = totalQty > 0 ? weightedPrice / totalQty : 0;
          totalFees = entryFee + exitFee;
          console.log(`\n  Found ${closingTrades.length} closing trade(s):`);
          console.log(`    Avg Exit Price: ${exitPrice}`);
          console.log(`    Exit Fee: ${exitFee}`);
          console.log(`    Realized PnL: ${realizedPnl}`);
        } else {
          console.log('  WARNING: Could not find any closing trades. Using mark price estimate.');
        }
      }
    }

    const entryPrice = parseFloat(icpPosition.entryPrice);
    const quantity = parseFloat(icpPosition.quantity);
    let pnl: number;
    if (realizedPnl !== 0) {
      pnl = realizedPnl;
    } else {
      const grossPnl = icpPosition.side === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;
      pnl = grossPnl - totalFees;
    }

    const pnlPercent = icpPosition.side === 'LONG'
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

    console.log(`\n  Calculated PnL: ${pnl.toFixed(4)} USDT (${pnlPercent.toFixed(2)}%)`);

    await db
      .update(tradeExecutions)
      .set({
        status: 'closed',
        exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
        exitSource: 'SYNC',
        exitReason: 'ORPHANED_POSITION',
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toFixed(2),
        fees: totalFees.toString(),
        entryFee: entryFee.toString(),
        exitFee: exitFee.toString(),
        closedAt: new Date(),
        updatedAt: new Date(),
        stopLossAlgoId: null,
        takeProfitAlgoId: null,
      })
      .where(eq(tradeExecutions.id, icpPosition.id));

    console.log('  ICPUSDT position closed in DB.');

    await db
      .update(wallets)
      .set({
        currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnl}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, WALLET_ID));

    console.log(`  Wallet balance updated by ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} USDT`);
  } else {
    console.log('  ICPUSDT open position not found in DB (may already be fixed).');
  }

  console.log('\n' + '-'.repeat(70));
  console.log('\n2. FIXING AAVEUSDT (on Binance but not in DB)\n');

  const [existingAave] = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, WALLET_ID),
        eq(tradeExecutions.symbol, 'AAVEUSDT'),
        eq(tradeExecutions.status, 'open')
      )
    )
    .limit(1);

  if (existingAave) {
    console.log('  AAVEUSDT already exists in DB (may already be fixed).');
  } else {
    const exchangePositions = await getPositions(client);
    const aavePosition = exchangePositions.find((p) => p.symbol === 'AAVEUSDT');

    if (!aavePosition) {
      console.log('  AAVEUSDT position not found on Binance (may have been closed).');
    } else {
      const positionAmt = parseFloat(aavePosition.positionAmt);
      const side = positionAmt > 0 ? 'LONG' : 'SHORT';
      const quantity = Math.abs(positionAmt);

      console.log(`  Binance position: ${side} ${quantity} @ ${aavePosition.entryPrice}`);
      console.log(`  Leverage: ${aavePosition.leverage}x, Margin: ${aavePosition.marginType}`);
      console.log(`  Liquidation: ${aavePosition.liquidationPrice}`);
      console.log(`  Unrealized PnL: ${aavePosition.unrealizedPnl}`);

      const algoOrders = await getOpenAlgoOrders(client, 'AAVEUSDT');
      const slOrder = algoOrders.find((o) => o.type === 'STOP_MARKET');
      const tpOrder = algoOrders.find((o) => o.type === 'TAKE_PROFIT_MARKET');

      if (slOrder) console.log(`  SL Algo: ${slOrder.algoId} @ ${slOrder.triggerPrice}`);
      if (tpOrder) console.log(`  TP Algo: ${tpOrder.algoId} @ ${tpOrder.triggerPrice}`);

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: wallet.userId,
        walletId: WALLET_ID,
        symbol: 'AAVEUSDT',
        side: side as 'LONG' | 'SHORT',
        entryPrice: aavePosition.entryPrice,
        quantity: quantity.toFixed(8),
        openedAt: new Date(aavePosition.updateTime || Date.now()),
        status: 'open',
        marketType: 'FUTURES',
        leverage: aavePosition.leverage,
        liquidationPrice: aavePosition.liquidationPrice,
        positionSide: 'BOTH',
        stopLoss: slOrder?.triggerPrice || null,
        takeProfit: tpOrder?.triggerPrice || null,
        stopLossAlgoId: slOrder?.algoId || null,
        takeProfitAlgoId: tpOrder?.algoId || null,
        stopLossIsAlgo: !!slOrder,
        takeProfitIsAlgo: !!tpOrder,
        entryOrderType: 'MARKET',
        highestPriceSinceEntry: aavePosition.entryPrice,
        lowestPriceSinceEntry: aavePosition.entryPrice,
        originalStopLoss: slOrder?.triggerPrice || null,
      });

      console.log(`\n  Created trade execution: ${executionId}`);
      console.log('  AAVEUSDT position synced to DB.');
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log('\n3. BALANCE SYNC\n');

  const accountInfo = await getAccountInfo(client);
  const binanceBalance = parseFloat(accountInfo.totalWalletBalance);

  const [updatedWallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  const dbBalance = parseFloat(updatedWallet?.currentBalance || '0');

  console.log(`  DB Balance (after ICP fix): ${dbBalance.toFixed(4)} USDT`);
  console.log(`  Binance Balance:            ${binanceBalance.toFixed(4)} USDT`);
  console.log(`  Difference:                 ${Math.abs(dbBalance - binanceBalance).toFixed(4)} USDT`);

  if (Math.abs(dbBalance - binanceBalance) > 1) {
    await db
      .update(wallets)
      .set({
        currentBalance: binanceBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, WALLET_ID));

    console.log(`\n  Balance updated to Binance value: ${binanceBalance.toFixed(4)} USDT`);
  } else {
    console.log('\n  Balance is close enough, no update needed.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('  VERIFICATION\n');

  const [finalWallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  const openPositions = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, WALLET_ID),
        eq(tradeExecutions.status, 'open'),
        eq(tradeExecutions.marketType, 'FUTURES')
      )
    );

  const exchangePositionsFinal = await getPositions(client);

  console.log(`  DB Balance: ${finalWallet?.currentBalance} USDT`);
  console.log(`  DB Open Positions: ${openPositions.length}`);
  console.log(`  Binance Positions: ${exchangePositionsFinal.length}`);

  const dbSymbols = new Set(openPositions.map((p) => p.symbol));
  const exchSymbols = new Set(exchangePositionsFinal.map((p) => p.symbol));

  const onlyDb = [...dbSymbols].filter((s) => !exchSymbols.has(s));
  const onlyExch = [...exchSymbols].filter((s) => !dbSymbols.has(s));

  if (onlyDb.length === 0 && onlyExch.length === 0) {
    console.log('\n  All positions are now in sync!');
  } else {
    if (onlyDb.length > 0) console.log(`\n  Still only in DB: ${onlyDb.join(', ')}`);
    if (onlyExch.length > 0) console.log(`\n  Still only on Binance: ${onlyExch.join(', ')}`);
  }

  console.log('\n  Open positions:');
  for (const pos of openPositions) {
    console.log(`    ${pos.symbol} ${pos.side} qty=${pos.quantity} entry=${pos.entryPrice} SL=${pos.stopLoss || '-'} TP=${pos.takeProfit || '-'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  DONE');
  console.log('='.repeat(70) + '\n');
}

fixSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
