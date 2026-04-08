import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetMarkPrice = vi.fn().mockResolvedValue(null);

vi.mock('../../binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getMarkPrice: (...args: unknown[]) => mockGetMarkPrice(...args),
  })),
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

const mockEmitLiquidationWarning = vi.fn();
const mockEmitRiskAlert = vi.fn();
vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    emitLiquidationWarning: mockEmitLiquidationWarning,
    emitRiskAlert: mockEmitRiskAlert,
  })),
}));

vi.mock('../../../constants', () => ({
  AUTO_TRADING_LIQUIDATION: {
    ALERT_COOLDOWN_MS: 300_000,
    MAX_ALERTS_IN_MEMORY: 200,
  },
}));

vi.mock('../types', () => ({
  LIQUIDATION_THRESHOLDS: {
    WARNING: 0.10,
    DANGER: 0.05,
    CRITICAL: 0.02,
  },
}));

import { checkLiquidationRisk } from '../liquidation-checks';

const createMockExecution = (overrides = {}) => ({
  id: 'exec-1',
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  liquidationPrice: '40000',
  entryPrice: '50000',
  quantity: '0.1',
  status: 'open',
  marketType: 'FUTURES',
  ...overrides,
}) as never;

describe('checkLiquidationRisk', () => {
  let testCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    testCounter++;
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z').getTime() + testCounter * 600_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return safe when mark price is far from liquidation', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 50000 });

    const results = await checkLiquidationRisk([createMockExecution()]);

    expect(results).toHaveLength(1);
    expect(results[0]!.riskLevel).toBe('safe');
  });

  it('should detect warning level for LONG position', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 43500 });

    const results = await checkLiquidationRisk([
      createMockExecution({ liquidationPrice: '40000' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.riskLevel).toBe('warning');
    expect(mockEmitLiquidationWarning).toHaveBeenCalled();
  });

  it('should detect danger level for LONG position', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 41500 });

    const results = await checkLiquidationRisk([
      createMockExecution({ liquidationPrice: '40000' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.riskLevel).toBe('danger');
  });

  it('should detect critical level for LONG position', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 40500 });

    const results = await checkLiquidationRisk([
      createMockExecution({ liquidationPrice: '40000' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.riskLevel).toBe('critical');
  });

  it('should detect risk for SHORT position correctly', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 58500 });

    const results = await checkLiquidationRisk([
      createMockExecution({ side: 'SHORT', liquidationPrice: '60000' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.riskLevel).toBe('danger');
  });

  it('should skip executions without liquidation price', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 50000 });

    const results = await checkLiquidationRisk([
      createMockExecution({ liquidationPrice: null }),
    ]);

    expect(results).toHaveLength(0);
  });

  it('should skip executions with zero liquidation price', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 50000 });

    const results = await checkLiquidationRisk([
      createMockExecution({ liquidationPrice: '0' }),
    ]);

    expect(results).toHaveLength(0);
  });

  it('should skip symbols when mark price is unavailable', async () => {
    mockGetMarkPrice.mockResolvedValueOnce(null);

    const results = await checkLiquidationRisk([createMockExecution()]);

    expect(results).toHaveLength(0);
  });

  it('should group executions by symbol and fetch mark price once per symbol', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 50000 });

    await checkLiquidationRisk([
      createMockExecution({ id: 'exec-1' }),
      createMockExecution({ id: 'exec-2' }),
    ]);

    expect(mockGetMarkPrice).toHaveBeenCalledTimes(1);
  });

  it('should emit both liquidation warning and risk alert', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 40500 });

    await checkLiquidationRisk([
      createMockExecution({ id: 'emit-both-exec', liquidationPrice: '40000' }),
    ]);

    expect(mockEmitLiquidationWarning).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      symbol: 'BTCUSDT',
      side: 'LONG',
      riskLevel: 'critical',
    }));
    expect(mockEmitRiskAlert).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
      type: 'LIQUIDATION_RISK',
      level: 'critical',
    }));
  });

  it('should respect alert cooldown period', async () => {
    mockGetMarkPrice.mockResolvedValue({ markPrice: 40500 });
    const uniqueExec = { id: 'cooldown-exec', liquidationPrice: '40000' };

    await checkLiquidationRisk([createMockExecution(uniqueExec)]);
    expect(mockEmitLiquidationWarning).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    await checkLiquidationRisk([createMockExecution(uniqueExec)]);
    expect(mockEmitLiquidationWarning).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300_001);
    vi.clearAllMocks();
    await checkLiquidationRisk([createMockExecution(uniqueExec)]);
    expect(mockEmitLiquidationWarning).toHaveBeenCalledTimes(1);
  });

  it('should not emit alerts for safe positions', async () => {
    mockGetMarkPrice.mockResolvedValueOnce({ markPrice: 55000 });

    await checkLiquidationRisk([createMockExecution({ liquidationPrice: '40000' })]);

    expect(mockEmitLiquidationWarning).not.toHaveBeenCalled();
    expect(mockEmitRiskAlert).not.toHaveBeenCalled();
  });

  it('should handle mark price fetch errors gracefully', async () => {
    mockGetMarkPrice.mockRejectedValueOnce(new Error('API error'));

    const results = await checkLiquidationRisk([createMockExecution()]);

    expect(results).toHaveLength(0);
  });

  it('should process multiple symbols independently', async () => {
    mockGetMarkPrice
      .mockResolvedValueOnce({ markPrice: 40500 })
      .mockResolvedValueOnce({ markPrice: 3000 });

    const results = await checkLiquidationRisk([
      createMockExecution({ id: 'exec-1', symbol: 'BTCUSDT', liquidationPrice: '40000' }),
      createMockExecution({ id: 'exec-2', symbol: 'ETHUSDT', liquidationPrice: '2000' }),
    ]);

    expect(results).toHaveLength(2);
    expect(mockGetMarkPrice).toHaveBeenCalledTimes(2);
  });
});
