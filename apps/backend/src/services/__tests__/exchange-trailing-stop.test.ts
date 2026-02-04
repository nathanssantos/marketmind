import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeTrailingStopService } from '../exchange-trailing-stop';

vi.mock('../../db', () => ({
  db: {
    query: {
      wallets: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('../binance', () => ({
  createBinanceClient: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../../env', () => ({
  env: {
    BINANCE_TESTNET_ENABLED: false,
  },
}));

describe('ExchangeTrailingStopService', () => {
  let service: ExchangeTrailingStopService;

  beforeEach(() => {
    service = new ExchangeTrailingStopService();
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should return false when testnet is disabled', () => {
      expect(service.isEnabled()).toBe(false);
    });
  });
});
