import { guardBinanceCall, binanceApiCache } from '../../src/services/binance-api-cache';

const SCRIPT_MIN_DELAY_MS = 1200;
let lastCallTime = 0;

export async function guardedCall<T>(fn: () => Promise<T>): Promise<T> {
  await waitIfBanned();
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < SCRIPT_MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, SCRIPT_MIN_DELAY_MS - elapsed));
  }
  lastCallTime = Date.now();
  return guardBinanceCall(fn);
}

export async function waitIfBanned(): Promise<void> {
  if (binanceApiCache.isBanned()) {
    const waitMs = binanceApiCache.getBanExpiresIn() + 2000;
    const waitSeconds = Math.ceil(waitMs / 1000);
    console.log(`\n⏳ IP banned by Binance. Waiting ${waitSeconds}s...\n`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

export function checkBan(): void {
  if (binanceApiCache.isBanned()) {
    const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
    console.error(`\nIP banned by Binance. Retry in ${waitSeconds}s.\n`);
    process.exit(1);
  }
}
