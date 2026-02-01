#!/usr/bin/env tsx
import { getAltcoinSeasonIndexService } from '../services/altcoin-season-index';
import { checkAdxCondition } from '../utils/filters/adx-filter';
import type { Kline } from '@marketmind/types';

const generateMockKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  let price = 50000;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 1000;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 500;
    const low = Math.min(open, close) - Math.random() * 500;
    price = close;

    klines.push({
      openTime: now - (count - i) * 12 * 60 * 60 * 1000,
      closeTime: now - (count - i - 1) * 12 * 60 * 60 * 1000,
      open: String(open),
      high: String(high),
      low: String(low),
      close: String(close),
      volume: String(Math.random() * 10000),
      quoteVolume: String(Math.random() * 500000000),
      trades: Math.floor(Math.random() * 100000),
      takerBuyBaseVolume: String(Math.random() * 5000),
      takerBuyQuoteVolume: String(Math.random() * 250000000),
    });
  }

  return klines;
};

const testAdxFilter = () => {
  console.log('\n=== Testing ADX Filter ===\n');

  const klines = generateMockKlines(100);
  const resultLong = checkAdxCondition(klines, 'LONG');
  const resultShort = checkAdxCondition(klines, 'SHORT');

  console.log('ADX Result (LONG):');
  console.log(`  ADX: ${resultLong.adx?.toFixed(2) ?? 'N/A'}`);
  console.log(`  +DI: ${resultLong.plusDI?.toFixed(2) ?? 'N/A'}`);
  console.log(`  -DI: ${resultLong.minusDI?.toFixed(2) ?? 'N/A'}`);
  console.log(`  Is Strong Trend: ${resultLong.isStrongTrend}`);
  console.log(`  Is Bullish: ${resultLong.isBullish}`);
  console.log(`  Is Bearish: ${resultLong.isBearish}`);
  console.log(`  Is Allowed: ${resultLong.isAllowed}`);
  console.log(`  Reason: ${resultLong.reason}`);

  console.log('\nADX Result (SHORT):');
  console.log(`  Is Allowed: ${resultShort.isAllowed}`);
  console.log(`  Reason: ${resultShort.reason}`);

  console.log('\n✅ ADX Filter test completed');
};

const testAltcoinSeasonIndex = async () => {
  console.log('\n=== Testing Altcoin Season Index ===\n');

  try {
    const service = getAltcoinSeasonIndexService();
    const result = await service.getAltcoinSeasonIndex();

    console.log('Altcoin Season Index Result:');
    console.log(`  Season Type: ${result.seasonType}`);
    console.log(`  Index: ${result.altSeasonIndex.toFixed(1)}%`);
    console.log(`  Alts Outperforming BTC: ${result.altsOutperformingBtc}/${result.totalAltsAnalyzed}`);
    console.log(`  BTC 24h Performance: ${result.btcPerformance24h.toFixed(2)}%`);
    console.log(`  Avg Alt 24h Performance: ${result.avgAltPerformance24h.toFixed(2)}%`);

    if (result.topPerformers.length > 0) {
      console.log('\n  Top Performers:');
      result.topPerformers.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.symbol}: +${p.performance.toFixed(2)}%`);
      });
    }

    if (result.worstPerformers.length > 0) {
      console.log('\n  Worst Performers:');
      result.worstPerformers.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p.symbol}: ${p.performance.toFixed(2)}%`);
      });
    }

    console.log('\n✅ Altcoin Season Index test completed');
  } catch (error) {
    console.error('❌ Error testing Altcoin Season Index:', error);
  }
};

const main = async () => {
  console.log('🧪 Testing New Indicators\n');
  console.log('='.repeat(50));

  testAdxFilter();
  await testAltcoinSeasonIndex();

  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed');
};

main().catch(console.error);
