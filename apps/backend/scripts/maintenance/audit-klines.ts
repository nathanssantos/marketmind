import { Command } from 'commander';
import { db } from '../../src/db/index.js';
import { klines } from '../../src/db/schema.js';
import { and, eq, desc } from 'drizzle-orm';
import type { Interval } from '@marketmind/types';

const program = new Command();

program
  .name('audit-klines')
  .description('Audit and compare klines with Binance API')
  .requiredOption('-s, --symbol <symbol>', 'Symbol (e.g., BTCUSDT)')
  .requiredOption('-i, --interval <interval>', 'Interval (e.g., 1h)')
  .option('-m, --marketType <type>', 'SPOT or FUTURES', 'FUTURES')
  .option('-l, --limit <number>', 'Number of recent klines', '100')
  .option('-f, --fix', 'Automatically fix mismatches')
  .parse();

const options = program.opts();

const fetchFromBinance = async (
  symbol: string,
  interval: string,
  openTime: number,
  marketType: string
): Promise<any> => {
  const baseUrl = marketType === 'FUTURES'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines';

  const response = await fetch(
    `${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${openTime}&limit=1`
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data[0];
};

const main = async () => {
  console.log(`Auditing ${options.symbol} ${options.interval} (${options.marketType})`);
  console.log('Fetching from database...\n');

  const dbKlines = await db.query.klines.findMany({
    where: and(
      eq(klines.symbol, options.symbol),
      eq(klines.interval, options.interval as Interval),
      eq(klines.marketType, options.marketType)
    ),
    orderBy: [desc(klines.openTime)],
    limit: parseInt(options.limit),
  });

  console.log(`Found ${dbKlines.length} klines in database`);
  console.log('Comparing with Binance API...\n');

  let mismatches = 0;
  let checked = 0;

  for (const kline of dbKlines) {
    checked++;

    const apiData = await fetchFromBinance(
      options.symbol,
      options.interval,
      kline.openTime.getTime(),
      options.marketType
    );

    if (!apiData) {
      console.log(`!  ${kline.openTime.toISOString()} - Not found in API`);
      continue;
    }

    const dbOHLC = {
      open: parseFloat(kline.open),
      high: parseFloat(kline.high),
      low: parseFloat(kline.low),
      close: parseFloat(kline.close),
    };

    const apiOHLC = {
      open: parseFloat(apiData[1]),
      high: parseFloat(apiData[2]),
      low: parseFloat(apiData[3]),
      close: parseFloat(apiData[4]),
    };

    const tolerance = 0.001;
    let hasMismatch = false;
    const diffs: string[] = [];

    for (const field of ['open', 'high', 'low', 'close'] as const) {
      const diff = Math.abs(dbOHLC[field] - apiOHLC[field]);
      const relativeDiff = diff / apiOHLC[field];

      if (relativeDiff > tolerance) {
        hasMismatch = true;
        diffs.push(
          `${field.toUpperCase()}: DB=${dbOHLC[field]} API=${apiOHLC[field]} (${(relativeDiff * 100).toFixed(3)}%)`
        );
      }
    }

    if (hasMismatch) {
      mismatches++;
      console.log(`✗ ${kline.openTime.toISOString()}`);
      diffs.forEach(d => console.log(`   ${d}`));

      if (options.fix) {
        await db
          .update(klines)
          .set({
            open: apiData[1],
            high: apiData[2],
            low: apiData[3],
            close: apiData[4],
            volume: apiData[5],
            closeTime: new Date(apiData[6]),
            quoteVolume: apiData[7],
            trades: apiData[8],
            takerBuyBaseVolume: apiData[9],
            takerBuyQuoteVolume: apiData[10],
          })
          .where(
            and(
              eq(klines.symbol, options.symbol),
              eq(klines.interval, options.interval as Interval),
              eq(klines.marketType, options.marketType),
              eq(klines.openTime, kline.openTime)
            )
          );
        console.log(`   ✓ Fixed`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Checked: ${checked}`);
  console.log(`Mismatches: ${mismatches} (${((mismatches / checked) * 100).toFixed(2)}%)`);

  if (options.fix) {
    console.log(`Fixed: ${mismatches}`);
  } else if (mismatches > 0) {
    console.log(`\nRun with --fix to automatically repair mismatches`);
  }

  process.exit(0);
};

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
