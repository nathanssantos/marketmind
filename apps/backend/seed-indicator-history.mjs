#!/usr/bin/env node

/**
 * Seeds indicator history with initial data points
 * Run this once to have data for the charts
 */

import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://marketmind:password@localhost:5432/marketmind';

async function seedIndicatorHistory() {
  console.log('🌱 Seeding indicator history...\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const now = Date.now();
  const HOUR = 60 * 60 * 1000;

  // Generate 31 days of data (every hour = 744 points per indicator)
  const values = [];

  for (let i = 31 * 24; i >= 0; i--) {
    const timestamp = new Date(now - i * HOUR);

    // ADX: varies between 15-50, with some trends
    const adxBase = 25 + Math.sin(i / 24) * 10;
    const adxNoise = (Math.random() - 0.5) * 10;
    const adx = Math.max(10, Math.min(60, adxBase + adxNoise));

    // Altcoin Season: varies between 20-80
    const altSeasonBase = 50 + Math.sin(i / 48) * 20;
    const altSeasonNoise = (Math.random() - 0.5) * 15;
    const altSeasonIndex = Math.max(10, Math.min(90, altSeasonBase + altSeasonNoise));

    // Order Book Imbalance: varies between 0.6-1.4
    const imbalanceBase = 1 + Math.sin(i / 12) * 0.2;
    const imbalanceNoise = (Math.random() - 0.5) * 0.3;
    const imbalance = Math.max(0.5, Math.min(1.5, imbalanceBase + imbalanceNoise));

    const ts = timestamp.toISOString();

    values.push(`('ADX', ${adx.toFixed(2)}, '${JSON.stringify({ plusDI: +(adx * 0.8).toFixed(1), minusDI: +(adx * 0.6).toFixed(1), isStrongTrend: adx > 25 })}', '${ts}')`);
    values.push(`('ALTCOIN_SEASON', ${altSeasonIndex.toFixed(2)}, '${JSON.stringify({
      seasonType: altSeasonIndex > 75 ? 'ALT_SEASON' : altSeasonIndex < 25 ? 'BTC_SEASON' : 'NEUTRAL',
      altsOutperformingBtc: Math.floor(altSeasonIndex / 2),
      totalAltsAnalyzed: 50
    })}', '${ts}')`);
    values.push(`('ORDER_BOOK_IMBALANCE', ${imbalance.toFixed(4)}, '${JSON.stringify({
      pressure: imbalance > 1.2 ? 'BUYING' : imbalance < 0.8 ? 'SELLING' : 'NEUTRAL',
      bidWalls: Math.floor(Math.random() * 3),
      askWalls: Math.floor(Math.random() * 3)
    })}', '${ts}')`);
  }

  console.log(`📊 Inserting ${values.length} data points...`);

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const query = `INSERT INTO indicator_history (indicator_type, value, metadata, recorded_at) VALUES ${batch.join(', ')}`;
    await client.query(query);
    console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(values.length / batchSize)}`);
  }

  console.log('\n✅ Seed complete!');
  console.log('   - ADX: 745 data points');
  console.log('   - Altcoin Season: 745 data points');
  console.log('   - Order Book Imbalance: 745 data points');

  await client.end();
}

seedIndicatorHistory().catch(console.error);
