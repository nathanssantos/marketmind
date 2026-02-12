import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FILTER_DEFAULTS } from '@marketmind/types';

let queryResults: Record<string, unknown[]> = {};
let queryCallIndex = 0;

const createChain = () => {
  const resolveResult = () => {
    const result = queryResults[`call-${queryCallIndex}`] ?? [];
    queryCallIndex++;
    return Promise.resolve(result);
  };

  const chainObj: Record<string, unknown> = {};

  chainObj.limit = () => resolveResult();

  chainObj.where = () => {
    return {
      limit: () => resolveResult(),
      then: (resolve: (val: unknown) => void, reject: (err: unknown) => void) => {
        return resolveResult().then(resolve, reject);
      },
    };
  };

  chainObj.from = () => chainObj;

  return chainObj;
};

vi.mock('../../../db', () => ({
  db: {
    select: () => createChain(),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: { walletId: 'walletId' },
  activeWatchers: { walletId: 'walletId' },
  tradingProfiles: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => ({})),
}));

const createMockAutoTradingConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 'config-1',
  walletId: 'wallet-1',
  enabledSetupTypes: JSON.stringify(['larry-williams-9-1']),
  positionSizePercent: '10',
  useStochasticFilter: false,
  useAdxFilter: false,
  useMtfFilter: false,
  useBtcCorrelationFilter: false,
  useMarketRegimeFilter: false,
  useDirectionFilter: false,
  enableLongInBearMarket: false,
  enableShortInBullMarket: false,
  useVolumeFilter: false,
  useFundingFilter: false,
  useConfluenceScoring: false,
  confluenceMinScore: 60,
  useMomentumTimingFilter: false,
  useTrendFilter: false,
  leverage: 1,
  tpCalculationMode: 'default',
  fibonacciTargetLevel: 'auto',
  ...overrides,
});

const createMockWatcher = (overrides: Record<string, unknown> = {}) => ({
  id: 'watcher-1',
  symbol: 'BTCUSDT',
  interval: '4h',
  marketType: 'FUTURES',
  profileId: null,
  walletId: 'wallet-1',
  ...overrides,
});

describe('configLoader - loadMultiWatcherConfigFromAutoTrading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = {};
    queryCallIndex = 0;
  });

  it('should throw error when no auto-trading config found for wallet', async () => {
    queryResults['call-0'] = [];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    await expect(
      loadMultiWatcherConfigFromAutoTrading('wallet-1', {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
      })
    ).rejects.toThrow('No auto-trading config found for wallet wallet-1');
  });

  it('should throw error when no active watchers found', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    await expect(
      loadMultiWatcherConfigFromAutoTrading('wallet-1', {
        startDate: '2024-01-01',
        endDate: '2024-06-01',
      })
    ).rejects.toThrow('No active watchers found for wallet wallet-1');
  });

  it('should build config with watcher setup types from profile', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig({
      positionSizePercent: '15',
      leverage: 10,
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevel: '1.618',
      useDirectionFilter: true,
      useAdxFilter: true,
    })];
    queryResults['call-1'] = [createMockWatcher({ profileId: 'profile-1' })];
    queryResults['call-2'] = [{
      id: 'profile-1',
      enabledSetupTypes: JSON.stringify(['nr7-breakout', 'rsi2-mean-reversion']),
    }];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      initialCapital: 20000,
    });

    expect(result.watchers).toHaveLength(1);
    expect(result.watchers[0]?.setupTypes).toEqual(['nr7-breakout', 'rsi2-mean-reversion']);
    expect(result.positionSizePercent).toBe(15);
    expect(result.leverage).toBe(10);
    expect(result.tpCalculationMode).toBe('fibonacci');
    expect(result.fibonacciTargetLevel).toBe('1.618');
    expect(result.initialCapital).toBe(20000);
    expect(result.useDirectionFilter).toBe(true);
    expect(result.useAdxFilter).toBe(true);
  });

  it('should use config enabledSetupTypes when watcher has no profile', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [createMockWatcher({ profileId: null })];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.watchers[0]?.setupTypes).toEqual(['larry-williams-9-1']);
  });

  it('should use config enabledSetupTypes when profile not found in DB', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig({
      enabledSetupTypes: JSON.stringify(['donchian-breakout']),
    })];
    queryResults['call-1'] = [createMockWatcher({ profileId: 'profile-missing' })];
    queryResults['call-2'] = [];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.watchers[0]?.setupTypes).toEqual(['donchian-breakout']);
  });

  it('should apply overrides over config values', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [createMockWatcher()];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading(
      'wallet-1',
      { startDate: '2024-01-01', endDate: '2024-06-01' },
      {
        tpCalculationMode: 'fibonacci',
        fibonacciTargetLevel: '2.618',
        useMtfFilter: true,
        useBtcCorrelationFilter: true,
        useMarketRegimeFilter: true,
        useDirectionFilter: true,
        enableLongInBearMarket: true,
        enableShortInBullMarket: true,
        useVolumeFilter: true,
        useFundingFilter: true,
        useConfluenceScoring: true,
        confluenceMinScore: 80,
        useMomentumTimingFilter: true,
        useTrendFilter: true,
        useStochasticFilter: true,
        useAdxFilter: true,
      }
    );

    expect(result.tpCalculationMode).toBe('fibonacci');
    expect(result.fibonacciTargetLevel).toBe('2.618');
    expect(result.useMtfFilter).toBe(true);
    expect(result.useBtcCorrelationFilter).toBe(true);
    expect(result.useMarketRegimeFilter).toBe(true);
    expect(result.useDirectionFilter).toBe(true);
    expect(result.enableLongInBearMarket).toBe(true);
    expect(result.enableShortInBullMarket).toBe(true);
    expect(result.useVolumeFilter).toBe(true);
    expect(result.useFundingFilter).toBe(true);
    expect(result.useConfluenceScoring).toBe(true);
    expect(result.confluenceMinScore).toBe(80);
    expect(result.useMomentumTimingFilter).toBe(true);
    expect(result.useTrendFilter).toBe(true);
    expect(result.useStochasticFilter).toBe(true);
    expect(result.useAdxFilter).toBe(true);
  });

  it('should default initialCapital to 10000 when not provided', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [createMockWatcher()];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.initialCapital).toBe(10000);
  });

  it('should set useSharedExposure to true and use first watcher marketType', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig({ leverage: 3 })];
    queryResults['call-1'] = [createMockWatcher({ marketType: 'SPOT' })];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.useSharedExposure).toBe(true);
    expect(result.trendFilterPeriod).toBe(FILTER_DEFAULTS.trendFilterPeriod);
    expect(result.marketType).toBe('SPOT');
    expect(result.leverage).toBe(3);
  });

  it('should handle multiple watchers with mixed profiles', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig({
      enabledSetupTypes: JSON.stringify(['default-setup']),
    })];
    queryResults['call-1'] = [
      createMockWatcher({ id: 'w1', symbol: 'BTCUSDT', profileId: 'profile-1' }),
      createMockWatcher({ id: 'w2', symbol: 'ETHUSDT', interval: '1h', profileId: null }),
    ];
    queryResults['call-2'] = [{
      id: 'profile-1',
      enabledSetupTypes: JSON.stringify(['profile-setup-1', 'profile-setup-2']),
    }];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.watchers).toHaveLength(2);
    expect(result.watchers[0]?.setupTypes).toEqual(['profile-setup-1', 'profile-setup-2']);
    expect(result.watchers[1]?.setupTypes).toEqual(['default-setup']);
    expect(result.setupTypes).toEqual(['default-setup']);
  });

  it('should set watcher profileId to undefined when null', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [createMockWatcher({ profileId: null })];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.watchers[0]?.profileId).toBeUndefined();
  });

  it('should preserve watcher profileId when present', async () => {
    queryResults['call-0'] = [createMockAutoTradingConfig()];
    queryResults['call-1'] = [createMockWatcher({ profileId: 'profile-abc' })];
    queryResults['call-2'] = [{
      id: 'profile-abc',
      enabledSetupTypes: JSON.stringify(['some-setup']),
    }];

    const { loadMultiWatcherConfigFromAutoTrading } = await import('../configLoader');

    const result = await loadMultiWatcherConfigFromAutoTrading('wallet-1', {
      startDate: '2024-01-01',
      endDate: '2024-06-01',
    });

    expect(result.watchers[0]?.profileId).toBe('profile-abc');
  });
});
