import { guardBinanceCall, binanceApiCache } from '../../src/services/binance-api-cache';

const SCRIPT_MIN_DELAY_MS = 250;
let lastCallTime = 0;

export async function guardedCall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < SCRIPT_MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, SCRIPT_MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
  return guardBinanceCall(fn);
}

export function checkBan(): void {
  if (binanceApiCache.isBanned()) {
    const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
    console.error(`\nIP banned by Binance. Retry in ${waitSeconds}s.\n`);
    process.exit(1);
  }
}
