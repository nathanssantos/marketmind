import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { klines } from '../src/db/schema';

const BINANCE_API = 'https://api.binance.com/api/v3/klines';

interface IntegrityIssue {
  symbol: string;
  interval: string;
  openTime: Date;
  issue: string;
  severity: 'warning' | 'critical';
  details: string;
}

const getIntervalMs = (interval: string): number => {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1));
  
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  
  throw new Error(`Unknown interval: ${interval}`);
};

const fetchLatestBinanceCandle = async (symbol: string, interval: string) => {
  const url = `${BINANCE_API}?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
  const data = await response.json();
  return data[0];
};

const auditKlineIntegrity = async (symbol: string, interval: string): Promise<IntegrityIssue[]> => {
  const issues: IntegrityIssue[] = [];
  
  console.log(`\nAuditing ${symbol} ${interval}...`);
  
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, symbol),
      eq(klines.interval, interval as any),
      gte(klines.openTime, lastHour)
    ),
    orderBy: sql`${klines.openTime} ASC`,
  });
  
  console.log(`  Found ${recentKlines.length} candles in last hour`);
  
  const intervalMs = getIntervalMs(interval);
  
  for (let i = 1; i < recentKlines.length; i++) {
    const prev = recentKlines[i - 1];
    const curr = recentKlines[i];
    
    const timeDiff = curr.openTime.getTime() - prev.openTime.getTime();
    
    if (timeDiff !== intervalMs) {
      issues.push({
        symbol,
        interval,
        openTime: curr.openTime,
        issue: 'Time gap detected',
        severity: 'critical',
        details: `Expected ${intervalMs}ms, got ${timeDiff}ms between ${prev.openTime.toISOString()} and ${curr.openTime.toISOString()}`,
      });
    }
    
    const prevClose = parseFloat(prev.close);
    const currOpen = parseFloat(curr.open);
    const priceDiff = Math.abs(currOpen - prevClose);
    const priceDiffPercent = (priceDiff / prevClose) * 100;
    
    if (priceDiffPercent > 2) {
      issues.push({
        symbol,
        interval,
        openTime: curr.openTime,
        issue: 'Large price gap',
        severity: 'warning',
        details: `Open=${currOpen} differs from previous Close=${prevClose} by ${priceDiffPercent.toFixed(2)}%`,
      });
    }
    
    const high = parseFloat(curr.high);
    const low = parseFloat(curr.low);
    const open = parseFloat(curr.open);
    const close = parseFloat(curr.close);
    
    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      issues.push({
        symbol,
        interval,
        openTime: curr.openTime,
        issue: 'Invalid OHLC values',
        severity: 'critical',
        details: `High=${high} Low=${low} Open=${open} Close=${close} - violates OHLC constraints`,
      });
    }
    
    const volume = parseFloat(curr.volume);
    if (volume < 0.00000001) {
      issues.push({
        symbol,
        interval,
        openTime: curr.openTime,
        issue: 'Suspicious low volume',
        severity: 'warning',
        details: `Volume=${volume} is extremely low, might be incomplete data`,
      });
    }
  }
  
  const latestBinanceCandle = await fetchLatestBinanceCandle(symbol, interval);
  const latestBinanceTime = latestBinanceCandle[0];
  const latestDbCandle = recentKlines[recentKlines.length - 1];
  
  if (latestDbCandle) {
    const dbTime = latestDbCandle.openTime.getTime();
    
    if (latestBinanceTime > dbTime && latestBinanceTime < Date.now() - intervalMs) {
      issues.push({
        symbol,
        interval,
        openTime: new Date(latestBinanceTime),
        issue: 'Missing latest closed candle',
        severity: 'critical',
        details: `Latest closed candle on Binance (${new Date(latestBinanceTime).toISOString()}) not in database`,
      });
    }
  }
  
  return issues;
};

const main = async () => {
  try {
    console.log('🔍 MarketMind Kline Integrity Audit');
    console.log(`Started at: ${new Date().toISOString()}\n`);
    console.log('Checking for:');
    console.log('  - Time gaps between candles');
    console.log('  - Invalid OHLC values');
    console.log('  - Suspicious volume data');
    console.log('  - Missing recent closed candles');
    console.log('  - Large unexpected price jumps\n');

    const assets = [
      { symbol: 'BTCUSDT', interval: '15m' },
      { symbol: 'ETHUSDT', interval: '15m' },
      { symbol: 'SOLUSDT', interval: '15m' },
      { symbol: 'XRPUSDT', interval: '30m' },
    ];

    let totalIssues = 0;
    let criticalIssues = 0;

    for (const asset of assets) {
      const issues = await auditKlineIntegrity(asset.symbol, asset.interval);
      
      if (issues.length === 0) {
        console.log(`  ✅ No issues found\n`);
      } else {
        console.log(`  ⚠️  Found ${issues.length} issue(s):\n`);
        
        issues.forEach((issue, idx) => {
          const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
          console.log(`  ${icon} Issue #${idx + 1}: ${issue.issue}`);
          console.log(`     Time: ${issue.openTime.toISOString()}`);
          console.log(`     Details: ${issue.details}\n`);
          
          totalIssues++;
          if (issue.severity === 'critical') criticalIssues++;
        });
      }
    }

    console.log('='.repeat(70));
    console.log(`Audit Summary:`);
    console.log(`  Total Issues: ${totalIssues}`);
    console.log(`  Critical: ${criticalIssues}`);
    console.log(`  Warnings: ${totalIssues - criticalIssues}`);
    
    if (totalIssues === 0) {
      console.log('\n✅ All klines are valid and consistent!');
    } else if (criticalIssues > 0) {
      console.log('\n🚨 Critical issues detected - immediate action required!');
    } else {
      console.log('\n⚠️  Minor issues detected - review recommended');
    }
    console.log('='.repeat(70));
    
    process.exit(totalIssues > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Error during audit:', error);
    process.exit(1);
  }
};

main();
