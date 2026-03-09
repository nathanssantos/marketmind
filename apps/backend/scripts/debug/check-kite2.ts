import 'dotenv/config';
import { db } from '../../src/db/client';
import { tradingProfiles, wallets, klines } from '../../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';

async function main() {
  // Global trailing stop config
  const profiles = await db.select().from(tradingProfiles).where(
    eq(tradingProfiles.walletId, 'kP_efbmZqtTyEJ4p2LLBx')
  );
  console.log('TRADING PROFILE (trailing stop config):', JSON.stringify(profiles.map(p => ({
    trailingStopEnabled: p.trailingStopEnabled,
    trailingActivationPercentLong: p.trailingActivationPercentLong,
    trailingActivationPercentShort: p.trailingActivationPercentShort,
    trailingDistancePercentLong: p.trailingDistancePercentLong,
    trailingDistancePercentShort: p.trailingDistancePercentShort,
    trailingActivationModeLong: p.trailingActivationModeLong,
    trailingActivationModeShort: p.trailingActivationModeShort,
    useAdaptiveTrailing: p.useAdaptiveTrailing,
  })), null, 2));

  // Check klines availability for KITEUSDT
  const klinesCount = await db.select().from(klines).where(
    and(eq(klines.symbol, 'KITEUSDT'), eq(klines.interval, '30m'), eq(klines.marketType, 'FUTURES'))
  );
  console.log(`\nKITEUSDT 30m FUTURES klines in DB: ${klinesCount.length}`);
  if (klinesCount.length > 0) {
    const sorted = klinesCount.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
    console.log('Most recent:', sorted[0]?.closeTime);
    console.log('Oldest:', sorted[sorted.length - 1]?.closeTime);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
