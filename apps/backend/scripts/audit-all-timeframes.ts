import { INTERVAL_MS } from '@marketmind/types';
import type { Interval, MarketType } from '@marketmind/types';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../src/db';
import { klines } from '../src/db/schema';

const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';

interface AuditResult {
  symbol: string;
  interval: string;
  marketType: string;
  binanceCount: number;
  dbCount: number;
  missingCount: number;
  extraCount: number;
  gaps: Array<{ start: Date; end: Date; count: number }>;
  valueIssues: Array<{ openTime: Date; field: string; db: string; binance: string }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchBinanceKlines = async (
  symbol: string,
  interval: Interval,
  startTime: number,
  endTime: number,
  marketType: MarketType = 'SPOT'
): Promise<any[]> => {
  const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
  const allKlines: any[] = [];
  let currentStart = startTime;
  const intervalMs = INTERVAL_MS[interval];

  while (currentStart < endTime) {
    const url = `${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=1000`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

    const data = await response.json();
    if (data.length === 0) break;

    allKlines.push(...data);
    currentStart = data[data.length - 1][0] + intervalMs;
    await sleep(100);
  }

  return allKlines;
};

const auditTimeframe = async (
  symbol: string,
  interval: Interval,
  marketType: MarketType,
  lookbackPeriods: number
): Promise<AuditResult> => {
  const intervalMs = INTERVAL_MS[interval];
  const now = Date.now();
  const startTime = now - intervalMs * lookbackPeriods;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 ${symbol} | ${interval} | ${marketType}`);
  console.log(`${'─'.repeat(60)}`);

  console.log(`Fetching from Binance (last ${lookbackPeriods} periods)...`);
  const binanceKlines = await fetchBinanceKlines(symbol, interval, startTime, now, marketType);
  console.log(`  Binance: ${binanceKlines.length} candles`);

  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval),
      eq(klines.marketType, marketType),
      gte(klines.openTime, new Date(startTime)),
      lte(klines.openTime, new Date(now))
    ),
    orderBy: [asc(klines.openTime)],
  });
  console.log(`  Database: ${dbKlines.length} candles`);

  const dbOpenTimes = new Map<number, typeof dbKlines[0]>();
  dbKlines.forEach((k) => dbOpenTimes.set(k.openTime.getTime(), k));

  const binanceOpenTimes = new Map<number, any>();
  binanceKlines.forEach((k) => binanceOpenTimes.set(k[0], k));

  const missingInDb: number[] = [];
  const valueIssues: AuditResult['valueIssues'] = [];

  const compareValues = (dbVal: string, binanceVal: string): boolean => {
    const tolerance = 0.00000001;
    return Math.abs(parseFloat(dbVal) - parseFloat(binanceVal)) < tolerance;
  };

  binanceKlines.forEach((bk) => {
    const openTime = bk[0];
    const dbKline = dbOpenTimes.get(openTime);

    if (!dbKline) {
      missingInDb.push(openTime);
    } else {
      if (!compareValues(dbKline.open, bk[1])) {
        valueIssues.push({ openTime: new Date(openTime), field: 'open', db: dbKline.open, binance: bk[1] });
      }
      if (!compareValues(dbKline.high, bk[2])) {
        valueIssues.push({ openTime: new Date(openTime), field: 'high', db: dbKline.high, binance: bk[2] });
      }
      if (!compareValues(dbKline.low, bk[3])) {
        valueIssues.push({ openTime: new Date(openTime), field: 'low', db: dbKline.low, binance: bk[3] });
      }
      if (!compareValues(dbKline.close, bk[4])) {
        valueIssues.push({ openTime: new Date(openTime), field: 'close', db: dbKline.close, binance: bk[4] });
      }
    }
  });

  const extraInDb = Array.from(dbOpenTimes.keys()).filter((t) => !binanceOpenTimes.has(t));

  const gaps: AuditResult['gaps'] = [];
  if (missingInDb.length > 0) {
    missingInDb.sort((a, b) => a - b);
    let gapStart = missingInDb[0];
    let gapCount = 1;

    for (let i = 1; i < missingInDb.length; i++) {
      if (missingInDb[i] - missingInDb[i - 1] === intervalMs) {
        gapCount++;
      } else {
        gaps.push({ start: new Date(gapStart), end: new Date(missingInDb[i - 1]), count: gapCount });
        gapStart = missingInDb[i];
        gapCount = 1;
      }
    }
    gaps.push({ start: new Date(gapStart), end: new Date(missingInDb[missingInDb.length - 1]), count: gapCount });
  }

  if (missingInDb.length === 0 && extraInDb.length === 0 && valueIssues.length === 0) {
    console.log(`  ✅ Perfect sync - no issues found`);
  } else {
    if (missingInDb.length > 0) {
      console.log(`  ⚠️  Missing: ${missingInDb.length} candles (${gaps.length} gap(s))`);
      gaps.slice(0, 3).forEach((g, i) => {
        console.log(`     Gap ${i + 1}: ${g.start.toISOString()} → ${g.end.toISOString()} (${g.count} candles)`);
      });
      if (gaps.length > 3) console.log(`     ... and ${gaps.length - 3} more gaps`);
    }
    if (extraInDb.length > 0) {
      console.log(`  ⚠️  Extra in DB: ${extraInDb.length} candles not in Binance`);
    }
    if (valueIssues.length > 0) {
      console.log(`  🔴 Value mismatches: ${valueIssues.length}`);
      valueIssues.slice(0, 3).forEach((v) => {
        console.log(`     ${v.openTime.toISOString()} - ${v.field}: DB=${v.db} vs Binance=${v.binance}`);
      });
    }
  }

  return {
    symbol,
    interval,
    marketType,
    binanceCount: binanceKlines.length,
    dbCount: dbKlines.length,
    missingCount: missingInDb.length,
    extraCount: extraInDb.length,
    gaps,
    valueIssues,
  };
};

const main = async () => {
  console.log('═'.repeat(60));
  console.log('🔍 MarketMind Comprehensive Kline Audit');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  const symbol = process.argv[2] || 'BTCUSDT';
  const marketType = (process.argv[3] || 'FUTURES') as MarketType;

  const intervalsToCheck: Interval[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
  const lookbackPeriods: Record<Interval, number> = {
    '1s': 100,
    '1m': 500,
    '3m': 300,
    '5m': 300,
    '15m': 200,
    '30m': 200,
    '1h': 168,
    '2h': 168,
    '4h': 168,
    '6h': 100,
    '8h': 100,
    '12h': 100,
    '1d': 100,
    '3d': 100,
    '1w': 52,
    '1M': 24,
    '1y': 10,
  };

  console.log(`\nAuditing: ${symbol} (${marketType})`);
  console.log(`Intervals: ${intervalsToCheck.join(', ')}`);

  const results: AuditResult[] = [];

  for (const interval of intervalsToCheck) {
    try {
      const result = await auditTimeframe(symbol, interval, marketType, lookbackPeriods[interval]);
      results.push(result);
      await sleep(500);
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(60));

  let totalMissing = 0;
  let totalValueIssues = 0;

  results.forEach((r) => {
    const status = r.missingCount === 0 && r.valueIssues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${r.interval.padEnd(4)} | DB: ${r.dbCount.toString().padStart(5)} | Missing: ${r.missingCount.toString().padStart(4)} | Value Issues: ${r.valueIssues.length}`);
    totalMissing += r.missingCount;
    totalValueIssues += r.valueIssues.length;
  });

  console.log('─'.repeat(60));
  console.log(`Total Missing: ${totalMissing} | Total Value Issues: ${totalValueIssues}`);

  if (totalMissing === 0 && totalValueIssues === 0) {
    console.log('\n✅ All timeframes are perfectly synchronized!');
  } else {
    console.log('\n⚠️  Issues detected - run backfill to fix gaps');
  }

  console.log('═'.repeat(60));
  process.exit(totalMissing > 0 || totalValueIssues > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
