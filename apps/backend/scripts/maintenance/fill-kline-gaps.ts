import { Command } from 'commander';
import type { Interval, MarketType } from '@marketmind/types';
import { INTERVAL_MS, TIME_MS } from '@marketmind/types';
import { smartBackfillKlines } from '../../src/services/binance-historical.js';

const program = new Command();

program
  .name('fill-kline-gaps')
  .description('Download every missing closed candle for the given series over the last N days')
  .requiredOption('-s, --symbols <list>', 'Comma-separated symbols (e.g. BTCUSDT,ETHUSDT)')
  .option('-i, --intervals <list>', 'Comma-separated intervals', '1m,5m,15m,1h,4h,1d')
  .option('-m, --marketType <type>', 'SPOT or FUTURES', 'FUTURES')
  .option('-d, --days <number>', 'Window to repair, in days', '60')
  .parse();

const options = program.opts<{ symbols: string; intervals: string; marketType: MarketType; days: string }>();

const parseList = (value: string): string[] => value.split(',').map((item) => item.trim()).filter(Boolean);

const main = async (): Promise<void> => {
  const symbols = parseList(options.symbols).map((symbol) => symbol.toUpperCase());
  const intervals = parseList(options.intervals) as Interval[];
  const windowMs = Number(options.days) * TIME_MS.DAY;

  for (const symbol of symbols) {
    for (const interval of intervals) {
      const targetCount = Math.ceil(windowMs / INTERVAL_MS[interval]);
      const result = await smartBackfillKlines(symbol, interval, targetCount, options.marketType);
      console.log(
        `${symbol} ${interval} ${options.marketType}: downloaded=${result.downloaded} inWindow=${result.totalInDb} unresolvedGaps=${result.gaps}`,
      );
    }
  }
};

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
