import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the options + instances every client construction receives.
const usdmInstances: Array<{ options: unknown; setTimeOffset: ReturnType<typeof vi.fn> }> = [];
const mainInstances: Array<{ options: unknown; setTimeOffset: ReturnType<typeof vi.fn> }> = [];

vi.mock('binance', () => ({
  USDMClient: class {
    setTimeOffset = vi.fn();
    getTimeOffset = (): number => 0;
    constructor(options: unknown) {
      usdmInstances.push({ options, setTimeOffset: this.setTimeOffset });
    }
  },
  MainClient: class {
    setTimeOffset = vi.fn();
    getTimeOffset = (): number => 0;
    constructor(options: unknown) {
      mainInstances.push({ options, setTimeOffset: this.setTimeOffset });
    }
  },
}));

vi.mock('../../services/encryption', () => ({
  decryptApiKey: (v: string) => `decrypted:${v}`,
}));

import {
  createBinanceClientForPrices,
  createBinanceFuturesClientForPrices,
  createBinanceFuturesClientFromCredentials,
  createBinanceSpotClientFromCredentials,
} from '../../services/binance-client';

const creds = { apiKey: 'k', apiSecret: 's', testnet: true };

describe('binance-client unified factories', () => {
  beforeEach(() => {
    usdmInstances.length = 0;
    mainInstances.length = 0;
  });

  it('credential factories build an authed client and apply the time offset', () => {
    createBinanceFuturesClientFromCredentials(creds);
    expect(usdmInstances).toHaveLength(1);
    expect(usdmInstances[0]!.options).toMatchObject({
      api_key: 'k',
      api_secret: 's',
      testnet: true,
      disableTimeSync: true,
    });
    // The offset must be stamped — this was the -1021 leak on the exchange
    // layer (BinanceFuturesExchangeClient) that drove the SL/TP failures.
    expect(usdmInstances[0]!.setTimeOffset).toHaveBeenCalledTimes(1);

    createBinanceSpotClientFromCredentials(creds);
    expect(mainInstances).toHaveLength(1);
    expect(mainInstances[0]!.setTimeOffset).toHaveBeenCalledTimes(1);
  });

  it('price (public) factories also apply the offset for uniformity', () => {
    createBinanceFuturesClientForPrices();
    createBinanceClientForPrices();
    expect(usdmInstances[0]!.setTimeOffset).toHaveBeenCalledTimes(1);
    expect(mainInstances[0]!.setTimeOffset).toHaveBeenCalledTimes(1);
    expect(usdmInstances[0]!.options).toMatchObject({ disableTimeSync: true });
  });
});
