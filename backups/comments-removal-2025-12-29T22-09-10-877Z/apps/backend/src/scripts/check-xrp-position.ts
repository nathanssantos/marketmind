import { db } from '../db/index.js';
import { tradeExecutions, setupDetections, klines } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { calculateSwingPoints, calculateATR } from '@marketmind/indicators';
import { computeTrailingStop, DEFAULT_TRAILING_STOP_CONFIG } from '../services/trailing-stop.js';
import type { Kline, Interval } from '@marketmind/types';

async function checkXrpPosition() {
  console.log('=== Checking XRP Position ===\n');

  const openExecutions = await db.query.tradeExecutions.findMany({
    where: and(
      eq(tradeExecutions.status, 'open'),
      eq(tradeExecutions.symbol, 'XRPUSDT')
    ),
  });

  if (openExecutions.length === 0) {
    console.log('No open XRP positions found');
    process.exit(0);
  }

  for (const exec of openExecutions) {
    console.log('--- Position Details ---');
    console.log('ID:', exec.id);
    console.log('Symbol:', exec.symbol);
    console.log('Side:', exec.side);
    console.log('Entry Price:', exec.entryPrice);
    console.log('Current Stop Loss:', exec.stopLoss);
    console.log('Take Profit:', exec.takeProfit);
    console.log('Opened At:', exec.openedAt);
    console.log('Quantity:', exec.quantity);

    if (exec.setupId) {
      const setup = await db.query.setupDetections.findFirst({
        where: eq(setupDetections.id, exec.setupId),
      });

      if (setup) {
        console.log('\n--- Setup Details ---');
        console.log('Interval:', setup.interval);

        const klinesData = await db.query.klines.findMany({
          where: and(
            eq(klines.symbol, 'XRPUSDT'),
            eq(klines.interval, setup.interval)
          ),
          orderBy: [desc(klines.openTime)],
          limit: 100,
        });

        if (klinesData.length > 20) {
          klinesData.reverse();

          const mappedKlines: Kline[] = klinesData.map((k) => ({
            symbol: k.symbol,
            interval: k.interval as Interval,
            openTime: k.openTime.getTime(),
            closeTime: k.closeTime.getTime(),
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
            quoteVolume: k.quoteVolume ?? '0',
            trades: k.trades ?? 0,
            takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
            takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
          }));

          const entryTime = new Date(exec.openedAt).getTime();
          const klinesAfterEntry = mappedKlines.filter(k => k.openTime >= entryTime);

          console.log('\n--- Klines Analysis ---');
          console.log('Total klines:', mappedKlines.length);
          console.log('Klines after entry:', klinesAfterEntry.length);

          if (klinesAfterEntry.length > 0) {
            const highestPrice = Math.max(...klinesAfterEntry.map(k => parseFloat(k.high)));
            const lowestPrice = Math.min(...klinesAfterEntry.map(k => parseFloat(k.low)));
            console.log('Highest price since entry:', highestPrice);
            console.log('Lowest price since entry:', lowestPrice);

            const entryPrice = parseFloat(exec.entryPrice);
            const currentPrice = parseFloat(mappedKlines[mappedKlines.length - 1]!.close);
            const isLong = exec.side === 'LONG';

            console.log('\n--- Trailing Stop Calculation ---');
            console.log('Entry price:', entryPrice);
            console.log('Current price:', currentPrice);

            const { swingPoints } = calculateSwingPoints(mappedKlines, DEFAULT_TRAILING_STOP_CONFIG.swingLookback);
            const atrValues = calculateATR(mappedKlines, 14);
            const currentATR = atrValues.length > 0 ? atrValues[atrValues.length - 1] : undefined;

            console.log('ATR:', currentATR);
            console.log('Swing points:', swingPoints.length);

            const trailingResult = computeTrailingStop(
              {
                entryPrice,
                currentPrice,
                currentStopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : null,
                side: exec.side,
                swingPoints: swingPoints.map(sp => ({ price: sp.price, type: sp.type })),
                atr: currentATR ?? undefined,
                highestPrice: isLong ? highestPrice : undefined,
                lowestPrice: isLong ? undefined : lowestPrice,
              },
              DEFAULT_TRAILING_STOP_CONFIG
            );

            if (trailingResult) {
              console.log('\n--- NEW Stop Loss Should Be ---');
              console.log('New SL:', trailingResult.newStopLoss);
              console.log('Reason:', trailingResult.reason);
            } else {
              console.log('\nNo trailing stop update needed');
            }
          }
        }
      }
    }
  }

  process.exit(0);
}

checkXrpPosition().catch(e => {
  console.error(e);
  process.exit(1);
});
