import { describe, expect, it } from 'vitest';
import { assertFuturesWallet, assertSideAllowedOnMarket, isSideAllowedOnMarket } from '../../utils/trading-validation';

describe('isSideAllowedOnMarket', () => {
  it('blocks SHORT on SPOT', () => {
    expect(isSideAllowedOnMarket('SPOT', 'SHORT')).toBe(false);
  });

  it('allows LONG on SPOT and both sides on FUTURES', () => {
    expect(isSideAllowedOnMarket('SPOT', 'LONG')).toBe(true);
    expect(isSideAllowedOnMarket('FUTURES', 'SHORT')).toBe(true);
    expect(isSideAllowedOnMarket('FUTURES', 'LONG')).toBe(true);
  });

  it('allows both sides when the market type is unknown', () => {
    expect(isSideAllowedOnMarket(undefined, 'SHORT')).toBe(true);
    expect(isSideAllowedOnMarket(null, 'SHORT')).toBe(true);
  });
});

describe('assertSideAllowedOnMarket', () => {
  it('throws for SHORT on SPOT', () => {
    expect(() => assertSideAllowedOnMarket('SPOT', 'SHORT')).toThrow('Spot wallets cannot open short positions');
  });

  it('does not throw for LONG on SPOT', () => {
    expect(() => assertSideAllowedOnMarket('SPOT', 'LONG')).not.toThrow();
  });
});

describe('assertFuturesWallet', () => {
  it('throws for a spot wallet', () => {
    expect(() => assertFuturesWallet({ marketType: 'SPOT' })).toThrow('Spot wallets cannot trade futures');
  });

  it('does not throw for a futures wallet or a wallet without market type', () => {
    expect(() => assertFuturesWallet({ marketType: 'FUTURES' })).not.toThrow();
    expect(() => assertFuturesWallet({ marketType: null })).not.toThrow();
  });
});
