import { fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { calculateEMA } from '@marketmind/indicators';

async function compare() {
  console.log('=== Simulating BacktestEngine EMA200 calculation ===');
  console.log('BacktestEngine fetches data from startDate (2024-01-01)');
  console.log('This means EMA200 has no historical context!\n');

  const start = new Date('2024-01-01');
  const end = new Date('2024-10-01');

  console.log('Fetching SOL data from Jan 1 (like BacktestEngine)...');
  const solKlines = await fetchHistoricalKlinesFromAPI('SOLUSDT', '4h', start, end);

  const solEma200 = calculateEMA(solKlines as any, 200);

  console.log(`\nTotal klines: ${solKlines.length}`);
  console.log(`EMA200 values: ${solEma200.filter(x => x !== null).length} non-null`);
  console.log(`First ${solEma200.slice(0, 10).map((v, i) => `[${i}]=${v?.toFixed(2) || 'null'}`).join(', ')}`);

  const firstValidEmaIndex = solEma200.findIndex(x => x !== null);
  if (firstValidEmaIndex >= 0) {
    const date = new Date(solKlines[firstValidEmaIndex].openTime);
    console.log(`\nFirst valid EMA200 at index ${firstValidEmaIndex}, date: ${date.toISOString()}`);
    console.log(`Price: $${parseFloat(solKlines[firstValidEmaIndex].close).toFixed(2)}, EMA200: $${solEma200[firstValidEmaIndex]?.toFixed(2)}`);
  }

  console.log('\n=== Impact on Trading ===');
  console.log('Setups before index 199 will have EMA200 = null');
  console.log('This causes the trend filter to be SKIPPED (not applied)!');

  console.log('\n--- Checking SHORT #2 entry (Jan 14, 2024) ---');
  const jan14 = solKlines.findIndex(k => {
    const d = new Date(k.openTime);
    return d >= new Date('2024-01-14T20:00:00Z');
  });
  console.log(`Index: ${jan14}`);
  console.log(`EMA200 at index ${jan14}: ${solEma200[jan14]?.toFixed(2) || 'NULL - trend filter NOT applied!'}`);
  console.log(`Price: $${parseFloat(solKlines[jan14].close).toFixed(2)}`);

  console.log('\n--- Checking SHORT #3 entry (Jan 18, 2024) ---');
  const jan18 = solKlines.findIndex(k => {
    const d = new Date(k.openTime);
    return d >= new Date('2024-01-18T20:00:00Z');
  });
  console.log(`Index: ${jan18}`);
  console.log(`EMA200 at index ${jan18}: ${solEma200[jan18]?.toFixed(2) || 'NULL - trend filter NOT applied!'}`);
  console.log(`Price: $${parseFloat(solKlines[jan18].close).toFixed(2)}`);

  console.log('\n--- Checking SHORT #4 entry (Feb 1, 2024) ---');
  const feb1 = solKlines.findIndex(k => {
    const d = new Date(k.openTime);
    return d >= new Date('2024-02-01T04:00:00Z');
  });
  console.log(`Index: ${feb1}`);
  console.log(`EMA200 at index ${feb1}: ${solEma200[feb1]?.toFixed(2) || 'NULL - trend filter NOT applied!'}`);
  console.log(`Price: $${parseFloat(solKlines[feb1].close).toFixed(2)}`);
}

compare().catch(console.error);
