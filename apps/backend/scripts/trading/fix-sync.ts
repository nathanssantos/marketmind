import 'dotenv/config';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { getWalletType } from '../../src/services/binance-client';
import {
  createBinanceFuturesClient,
  getAccountInfo,
  getOpenAlgoOrders,
  getPositions,
  getAllTradeFeesForPosition,
  getLastClosingTrade,
  getRecentTrades,
  cancelFuturesAlgoOrder,
} from '../../src/services/binance-futures-client';
import { decryptApiKey } from '../../src/services/encryption';
import { guardedCall, checkBan } from '../utils/binance-script-guard';

async function fixSync() {
  console.log('\n' + '='.repeat(70));
  console.log('  SYNC FIX SCRIPT');
  console.log('='.repeat(70) + '\n');

  const allWallets = await db.select().from(wallets);
  const futuresWallets = allWallets.filter(
    (w) => {
      const wType = getWalletType(w);
      return wType !== 'paper' && w.apiKeyEncrypted && w.apiSecretEncrypted && w.marketType === 'FUTURES';
    }
  );

  if (futuresWallets.length === 0) {
    console.log('No live FUTURES wallets found.');
    process.exit(0);
  }

  for (const wallet of futuresWallets) {
    const walletType = getWalletType(wallet);
    console.log('-'.repeat(70));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log('-'.repeat(70));

    const client = createBinanceFuturesClient(wallet);

    checkBan();
    const exchangePositions = await guardedCall(() => getPositions(client));
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

    const exchangeBySymbol = new Map(exchangePositions.map((p) => [p.symbol, p]));

    const orphanedPositions = dbOpenPositions.filter((p) => !exchangeBySymbol.has(p.symbol));

    if (orphanedPositions.length === 0) {
      console.log('\n  No orphaned positions found.\n');
    }

    for (const orphan of orphanedPositions) {
      console.log(`\n  FIXING ORPHANED: ${orphan.symbol} ${orphan.side}`);
      console.log(`    Entry: ${orphan.entryPrice}, Qty: ${orphan.quantity}`);
      console.log(`    SL Algo: ${orphan.stopLossAlgoId || '-'}, TP Algo: ${orphan.takeProfitAlgoId || '-'}`);

      if (orphan.takeProfitAlgoId) {
        console.log(`\n    Cancelling orphan TP algo ${orphan.takeProfitAlgoId} on Binance...`);
        try {
          await guardedCall(() => cancelFuturesAlgoOrder(client, orphan.takeProfitAlgoId!));
          console.log('    TP algo cancelled successfully.');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('not found') || msg.includes('Unknown order') || msg.includes('does not exist')) {
            console.log('    TP algo already cancelled/not found.');
          } else {
            console.log(`    WARNING: Failed to cancel TP algo: ${msg}`);
          }
        }
      }

      if (orphan.stopLossAlgoId) {
        console.log(`\n    Cancelling orphan SL algo ${orphan.stopLossAlgoId} on Binance...`);
        try {
          await guardedCall(() => cancelFuturesAlgoOrder(client, orphan.stopLossAlgoId!));
          console.log('    SL algo cancelled successfully.');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('not found') || msg.includes('Unknown order') || msg.includes('does not exist')) {
            console.log('    SL algo already cancelled/filled.');
          } else {
            console.log(`    WARNING: Failed to cancel SL algo: ${msg}`);
          }
        }
      }

      const openedAt = orphan.openedAt?.getTime() || orphan.createdAt.getTime();
      let exitPrice = 0;
      let entryFee = parseFloat(orphan.entryFee || '0');
      let exitFee = 0;
      let totalFees = entryFee;
      let realizedPnl = 0;

      console.log('\n    Fetching trade data from Binance...');

      const allFees = await guardedCall(() => getAllTradeFeesForPosition(client, orphan.symbol, orphan.side, openedAt));

      if (allFees) {
        exitPrice = allFees.exitPrice;
        entryFee = allFees.entryFee;
        exitFee = allFees.exitFee;
        totalFees = allFees.totalFees;
        realizedPnl = allFees.realizedPnl;
        console.log(`    Trade data found:`);
        console.log(`      Exit Price: ${exitPrice}`);
        console.log(`      Entry Fee: ${entryFee.toFixed(8)}`);
        console.log(`      Exit Fee: ${exitFee.toFixed(8)}`);
        console.log(`      Total Fees: ${totalFees.toFixed(8)}`);
        console.log(`      Realized PnL (Binance): ${realizedPnl.toFixed(4)}`);
      } else {
        const closingTrade = await guardedCall(() => getLastClosingTrade(client, orphan.symbol, orphan.side, openedAt));
        if (closingTrade) {
          exitPrice = closingTrade.price;
          exitFee = closingTrade.commission;
          totalFees = entryFee + exitFee;
          realizedPnl = closingTrade.realizedPnl;
          console.log(`    Closing trade found (fallback):`);
          console.log(`      Exit Price: ${exitPrice}`);
          console.log(`      Exit Fee: ${exitFee.toFixed(8)}`);
          console.log(`      Realized PnL: ${realizedPnl.toFixed(4)}`);
        } else {
          console.log('    No trade data found. Using recent trades...');
          const recentTrades = await guardedCall(() => getRecentTrades(client, orphan.symbol, 50));
          const closingSide = orphan.side === 'LONG' ? 'SELL' : 'BUY';
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
            console.log(`    Found ${closingTrades.length} closing trade(s):`);
            console.log(`      Avg Exit Price: ${exitPrice}`);
            console.log(`      Exit Fee: ${exitFee.toFixed(8)}`);
            console.log(`      Realized PnL: ${realizedPnl.toFixed(4)}`);
          } else {
            console.log('    WARNING: Could not find any closing trades on Binance.');
          }
        }
      }

      const entryPrice = parseFloat(orphan.entryPrice);
      const quantity = parseFloat(orphan.quantity);
      const leverage = orphan.leverage || 1;
      let pnl: number;
      if (realizedPnl !== 0) {
        pnl = realizedPnl;
      } else {
        const grossPnl = orphan.side === 'LONG'
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;
        pnl = grossPnl - totalFees;
      }

      const entryValue = entryPrice * quantity;
      const marginValue = entryValue / leverage;
      const pnlPercent = marginValue > 0 ? (pnl / marginValue) * 100 : 0;

      console.log(`\n    Calculated PnL: ${pnl.toFixed(4)} USDT (${pnlPercent.toFixed(2)}%)`);

      await db
        .update(tradeExecutions)
        .set({
          status: 'closed',
          exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
          exitSource: 'SYNC',
          exitReason: 'ORPHANED_POSITION',
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toFixed(4),
          fees: totalFees.toString(),
          entryFee: entryFee.toString(),
          exitFee: exitFee.toString(),
          closedAt: new Date(),
          updatedAt: new Date(),
          stopLossAlgoId: null,
          stopLossOrderId: null,
          takeProfitAlgoId: null,
          takeProfitOrderId: null,
        })
        .where(eq(tradeExecutions.id, orphan.id));

      console.log(`    ${orphan.symbol} position closed in DB.`);
    }

    console.log('\n' + '-'.repeat(70));
    console.log('  BALANCE SYNC\n');

    const accountInfo = await guardedCall(() => getAccountInfo(client));
    const binanceBalance = parseFloat(accountInfo.totalWalletBalance);

    const [updatedWallet] = await db.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1);
    const dbBalance = parseFloat(updatedWallet?.currentBalance || '0');

    console.log(`  DB Balance:      ${dbBalance.toFixed(4)} USDT`);
    console.log(`  Binance Balance: ${binanceBalance.toFixed(4)} USDT`);
    console.log(`  Difference:      ${Math.abs(dbBalance - binanceBalance).toFixed(4)} USDT`);

    if (Math.abs(dbBalance - binanceBalance) > 0.5) {
      await db
        .update(wallets)
        .set({
          currentBalance: binanceBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      console.log(`  Balance synced to Binance value: ${binanceBalance.toFixed(4)} USDT`);
    } else {
      console.log('  Balance is in sync.');
    }

    console.log('\n' + '-'.repeat(70));
    console.log('  VERIFICATION\n');

    const [finalWallet] = await db.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1);
    const openPositions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    const exchangePositionsFinal = await guardedCall(() => getPositions(client));

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
