import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { decryptApiKey } from '../../src/services/encryption';
import { getWalletType } from '../../src/services/binance-client';

interface AlgoOrder {
  algoId: number;
  symbol: string;
  side: string;
  orderType: string;
  quantity: string;
  triggerPrice?: string | number;
  price?: string | number;
  algoStatus: string;
  createTime: number;
  updateTime: number;
}

interface ExchangePosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  positionSide: string;
  notional: string;
  updateTime: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  POSITION AUDIT');
  console.log('  Compares open DB positions with exchange positions');
  console.log('='.repeat(80));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const allWallets = await db.select().from(wallets);
  const liveWallets = allWallets.filter(w => {
    const wType = getWalletType(w);
    return wType !== 'paper' && w.apiKeyEncrypted && w.apiSecretEncrypted && w.marketType === 'FUTURES';
  });

  if (liveWallets.length === 0) {
    console.log('No live/testnet FUTURES wallets found.');
    process.exit(0);
  }

  console.log(`Found ${liveWallets.length} live/testnet FUTURES wallet(s)\n`);

  let totalOrphaned = 0;
  let totalUnknown = 0;
  let totalMatched = 0;
  let totalMismatches = 0;

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log('-'.repeat(80));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log('-'.repeat(80));

    const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);
    const client = new USDMClient({
      api_key: apiKey,
      api_secret: apiSecret,
      testnet: walletType === 'testnet',
      disableTimeSync: false,
    });

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

    await sleep(200);

    let exchangePositions: ExchangePosition[] = [];
    try {
      const accountInfo = await client.getAccountInformation();
      exchangePositions = (accountInfo.positions as ExchangePosition[])
        .filter(p => parseFloat(p.positionAmt) !== 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR fetching exchange positions: ${msg}`);
      continue;
    }

    console.log(`  DB open positions:      ${dbOpenPositions.length}`);
    console.log(`  DB pending positions:    ${dbPendingPositions.length}`);
    console.log(`  Exchange positions:      ${exchangePositions.length}\n`);

    const exchangeBySymbol = new Map<string, ExchangePosition>();
    for (const p of exchangePositions) exchangeBySymbol.set(p.symbol, p);

    const dbBySymbol = new Map<string, typeof dbOpenPositions[0]>();
    for (const p of dbOpenPositions) dbBySymbol.set(p.symbol, p);

    for (const dbPos of dbOpenPositions) {
      const exchangePos = exchangeBySymbol.get(dbPos.symbol);

      if (!exchangePos) {
        totalOrphaned++;
        const dbQty = parseFloat(dbPos.quantity);
        const dbEntry = parseFloat(dbPos.entryPrice);
        console.log(`  ORPHANED (in DB, not on exchange):`);
        console.log(`    ${dbPos.symbol} ${dbPos.side} | qty=${dbQty} entry=${dbEntry}`);
        console.log(`    ID: ${dbPos.id}`);
        console.log(`    Opened: ${dbPos.openedAt?.toISOString() || dbPos.createdAt.toISOString()}`);
        if (dbPos.stopLoss) console.log(`    SL: ${dbPos.stopLoss}`);
        if (dbPos.takeProfit) console.log(`    TP: ${dbPos.takeProfit}`);
        console.log('');
        continue;
      }

      const dbQty = parseFloat(dbPos.quantity);
      const dbEntry = parseFloat(dbPos.entryPrice);
      const exchangeQty = Math.abs(parseFloat(exchangePos.positionAmt));
      const exchangeEntry = parseFloat(exchangePos.entryPrice);
      const exchangeMarkPrice = parseFloat(exchangePos.markPrice);
      const unrealizedPnl = parseFloat(exchangePos.unRealizedProfit);
      const exchangeLeverage = parseInt(exchangePos.leverage);

      const qtyMismatch = Math.abs(dbQty - exchangeQty) > 0.00001;
      const entryMismatch = dbEntry > 0 && exchangeEntry > 0 && Math.abs(dbEntry - exchangeEntry) / exchangeEntry > 0.001;
      const leverageMismatch = dbPos.leverage !== null && dbPos.leverage !== exchangeLeverage;

      const issues: string[] = [];
      if (qtyMismatch) issues.push(`QTY: db=${dbQty} vs exchange=${exchangeQty}`);
      if (entryMismatch) issues.push(`ENTRY: db=${dbEntry} vs exchange=${exchangeEntry}`);
      if (leverageMismatch) issues.push(`LEVERAGE: db=${dbPos.leverage} vs exchange=${exchangeLeverage}`);

      const dbEntryFee = parseFloat(dbPos.entryFee || '0');
      if (dbEntryFee === 0) issues.push('MISSING ENTRY FEE');

      if (issues.length > 0) {
        totalMismatches++;
        console.log(`  MISMATCH: ${dbPos.symbol} ${dbPos.side}`);
        console.log(`    DB:       qty=${dbQty} entry=${dbEntry} leverage=${dbPos.leverage} entryFee=${dbEntryFee.toFixed(8)}`);
        console.log(`    Exchange: qty=${exchangeQty} entry=${exchangeEntry} leverage=${exchangeLeverage} markPrice=${exchangeMarkPrice} unrealizedPnl=${unrealizedPnl.toFixed(4)}`);
        for (const issue of issues) console.log(`    >> ${issue}`);

        if (dbPos.stopLoss) console.log(`    SL: ${dbPos.stopLoss}`);
        if (dbPos.takeProfit) console.log(`    TP: ${dbPos.takeProfit}`);
        console.log('');
      } else {
        totalMatched++;
      }

      exchangeBySymbol.delete(dbPos.symbol);
    }

    for (const [symbol, exchangePos] of exchangeBySymbol) {
      const isPending = dbPendingPositions.some(p => p.symbol === symbol);
      if (isPending) {
        console.log(`  PENDING MATCH: ${symbol} (exchange position exists, DB status=pending)`);
        const qty = Math.abs(parseFloat(exchangePos.positionAmt));
        const entry = parseFloat(exchangePos.entryPrice);
        console.log(`    Exchange: qty=${qty} entry=${entry} leverage=${exchangePos.leverage}`);
        console.log('');
        continue;
      }

      totalUnknown++;
      const qty = Math.abs(parseFloat(exchangePos.positionAmt));
      const entry = parseFloat(exchangePos.entryPrice);
      const markPrice = parseFloat(exchangePos.markPrice);
      const unrealizedPnl = parseFloat(exchangePos.unRealizedProfit);
      const side = parseFloat(exchangePos.positionAmt) > 0 ? 'LONG' : 'SHORT';

      console.log(`  UNKNOWN (on exchange, not in DB):`);
      console.log(`    ${symbol} ${side} | qty=${qty} entry=${entry} markPrice=${markPrice} unrealizedPnl=${unrealizedPnl.toFixed(4)}`);
      console.log(`    Leverage: ${exchangePos.leverage}x | Notional: ${exchangePos.notional}`);
      console.log(`    Last update: ${new Date(exchangePos.updateTime).toISOString()}`);
      console.log('');
    }

    await sleep(200);
    console.log('  PROTECTION ORDERS CHECK (Conditional/Algo Orders):');
    try {
      const algoOrdersResponse = await client.getOpenAlgoOrders();
      const algoOrders = Array.isArray(algoOrdersResponse) ? algoOrdersResponse : (algoOrdersResponse as { orders: AlgoOrder[] }).orders || [];

      console.log(`    Total conditional orders on exchange: ${algoOrders.length}\n`);

      const algoBySymbol = new Map<string, AlgoOrder[]>();
      for (const order of algoOrders) {
        const sym = order.symbol;
        if (!algoBySymbol.has(sym)) algoBySymbol.set(sym, []);
        algoBySymbol.get(sym)!.push(order);
      }

      for (const dbPos of dbOpenPositions) {
        const orders = algoBySymbol.get(dbPos.symbol) || [];

        const hasSLInDb = dbPos.stopLossOrderId || dbPos.stopLossAlgoId;
        const hasTPInDb = dbPos.takeProfitOrderId || dbPos.takeProfitAlgoId;

        const slOrders = orders.filter(o =>
          o.orderType === 'STOP_MARKET' || o.orderType === 'STOP'
        );
        const tpOrders = orders.filter(o =>
          o.orderType === 'TAKE_PROFIT_MARKET' || o.orderType === 'TAKE_PROFIT'
        );

        const slMatchById = slOrders.some(o =>
          String(o.algoId) === String(dbPos.stopLossAlgoId)
        );
        const tpMatchById = tpOrders.some(o =>
          String(o.algoId) === String(dbPos.takeProfitAlgoId)
        );

        const issues: string[] = [];

        if (hasSLInDb && slOrders.length === 0) {
          issues.push('SL in DB but NO Stop Market order on exchange');
        } else if (hasSLInDb && !slMatchById) {
          issues.push(`SL algo ID mismatch: DB=${dbPos.stopLossAlgoId} but exchange has [${slOrders.map(o => o.algoId).join(', ')}]`);
        }

        if (hasTPInDb && tpOrders.length === 0) {
          issues.push('TP in DB but NO Take Profit order on exchange');
        } else if (hasTPInDb && !tpMatchById) {
          issues.push(`TP algo ID mismatch: DB=${dbPos.takeProfitAlgoId} but exchange has [${tpOrders.map(o => o.algoId).join(', ')}]`);
        }

        if (!hasSLInDb && !hasTPInDb) {
          issues.push('No protection orders in DB');
        }

        if (slOrders.length > 1) issues.push(`DUPLICATE: ${slOrders.length} Stop Market orders on exchange`);
        if (tpOrders.length > 1) issues.push(`DUPLICATE: ${tpOrders.length} Take Profit orders on exchange`);

        const dbSLPrice = parseFloat(dbPos.stopLoss || '0');
        const dbTPPrice = parseFloat(dbPos.takeProfit || '0');

        for (const sl of slOrders) {
          const triggerPrice = parseFloat(String(sl.triggerPrice || '0'));
          if (dbSLPrice > 0 && triggerPrice > 0 && Math.abs(dbSLPrice - triggerPrice) / dbSLPrice > 0.001) {
            issues.push(`SL PRICE MISMATCH: DB=${dbSLPrice} vs exchange=${triggerPrice}`);
          }
        }

        for (const tp of tpOrders) {
          const triggerPrice = parseFloat(String(tp.triggerPrice || '0'));
          if (dbTPPrice > 0 && triggerPrice > 0 && Math.abs(dbTPPrice - triggerPrice) / dbTPPrice > 0.001) {
            issues.push(`TP PRICE MISMATCH: DB=${dbTPPrice} vs exchange=${triggerPrice}`);
          }
        }

        if (issues.length > 0) {
          console.log(`    ${dbPos.symbol} ${dbPos.side}:`);
          for (const issue of issues) console.log(`      >> ${issue}`);
          console.log(`      DB: SL algoId=${dbPos.stopLossAlgoId} price=${dbPos.stopLoss} | TP algoId=${dbPos.takeProfitAlgoId} price=${dbPos.takeProfit}`);
          for (const o of orders) {
            console.log(`        Exchange: algoId=${o.algoId} type=${o.orderType} side=${o.side} trigger=${o.triggerPrice} status=${o.algoStatus}`);
          }
          console.log('');
        } else {
          console.log(`    ${dbPos.symbol} ${dbPos.side}: OK (SL=${slOrders.length} TP=${tpOrders.length})`);
        }
      }

      const dbSymbols = new Set(dbOpenPositions.map(p => p.symbol));
      for (const [sym, orders] of algoBySymbol) {
        if (!dbSymbols.has(sym)) {
          console.log(`\n    ORPHAN ALGO ORDERS (no DB position): ${sym}`);
          for (const o of orders) {
            console.log(`      algoId=${o.algoId} type=${o.orderType} side=${o.side} trigger=${o.triggerPrice} qty=${o.quantity}`);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`    ERROR fetching algo orders: ${msg}`);
    }

    const dbBalance = parseFloat(wallet.currentBalance || '0');
    try {
      await sleep(200);
      const account = await client.getBalance();
      const usdtBalance = account.find(b => b.asset === 'USDT');
      if (usdtBalance) {
        const exchangeBalance = parseFloat(usdtBalance.balance);
        const availableBalance = parseFloat(usdtBalance.availableBalance);
        const crossUnPnl = parseFloat(usdtBalance.crossUnPnl);

        console.log(`\n  BALANCE CHECK:`);
        console.log(`    DB balance:             ${dbBalance.toFixed(4)}`);
        console.log(`    Exchange balance:        ${exchangeBalance.toFixed(4)}`);
        console.log(`    Available balance:       ${availableBalance.toFixed(4)}`);
        console.log(`    Unrealized PnL:          ${crossUnPnl.toFixed(4)}`);

        const diff = Math.abs(dbBalance - exchangeBalance);
        if (diff > 1) {
          console.log(`    >> BALANCE MISMATCH: diff=$${diff.toFixed(4)}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`\n  BALANCE CHECK ERROR: ${msg}`);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Matched positions:    ${totalMatched}`);
  console.log(`  Mismatched positions: ${totalMismatches}`);
  console.log(`  Orphaned (DB only):   ${totalOrphaned}`);
  console.log(`  Unknown (exchange):   ${totalUnknown}`);

  if (totalOrphaned === 0 && totalUnknown === 0 && totalMismatches === 0) {
    console.log('\n  All positions are in sync.');
  }

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
