import { describe, expect, it, beforeEach } from 'vitest';
import { TRADING_DEFAULTS } from '@marketmind/types';
import {
  SharedPortfolioManager,
  type PortfolioConfig,
} from '../../services/backtesting/SharedPortfolioManager';
import type { TradingSetup } from '@marketmind/types';

const createPortfolioConfig = (overrides: Partial<PortfolioConfig> = {}): PortfolioConfig => ({
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  positionSizePercent: TRADING_DEFAULTS.POSITION_SIZE_PERCENT,
  maxPositionSizePercent: 15,
  maxConcurrentPositions: 5,
  dailyLossLimitPercent: TRADING_DEFAULTS.DAILY_LOSS_LIMIT_PERCENT,
  cooldownMinutes: TRADING_DEFAULTS.COOLDOWN_MINUTES,
  useStochasticFilter: false,
  useStochasticRecoveryFilter: false,
  useMomentumTimingFilter: false,
  useAdxFilter: false,
  useTrendFilter: false,
  minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
  ...overrides,
});

const createSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  id: 'setup-1',
  type: 'larry-williams-9-1',
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  confidence: 0.8,
  openTime: Date.now(),
  riskRewardRatio: 2,
  volumeConfirmation: true,
  indicatorConfluence: 3,
  klineIndex: 100,
  setupData: {},
  visible: true,
  source: 'algorithm',
  ...overrides,
});

describe('SharedPortfolioManager', () => {
  describe('Dynamic Position Size Calculation', () => {
    it('should calculate position size based on positionSizePercent', () => {
      const activeWatchers = 3;
      const portfolio = new SharedPortfolioManager(createPortfolioConfig(), activeWatchers);
      const { exposurePerWatcher, maxPositionValue, maxTotalExposure } =
        portfolio.calculateExposureForNewPosition();

      const expectedExposure = TRADING_DEFAULTS.POSITION_SIZE_PERCENT;
      const expectedPositionValue = (TRADING_DEFAULTS.INITIAL_CAPITAL * TRADING_DEFAULTS.POSITION_SIZE_PERCENT) / 100;
      const expectedTotalExposure = (TRADING_DEFAULTS.INITIAL_CAPITAL * TRADING_DEFAULTS.POSITION_SIZE_PERCENT * activeWatchers) / 100;

      expect(exposurePerWatcher).toBe(expectedExposure);
      expect(maxPositionValue).toBe(expectedPositionValue);
      expect(maxTotalExposure).toBe(expectedTotalExposure);
    });

    it('should return positionSizePercent as exposurePerWatcher regardless of watchers', () => {
      const portfolio = new SharedPortfolioManager(
        createPortfolioConfig({ positionSizePercent: 50 }),
        2
      );
      const { exposurePerWatcher } = portfolio.calculateExposureForNewPosition();

      expect(exposurePerWatcher).toBe(50);
    });

    it('should return positionSizePercent even with zero watchers', () => {
      const portfolio = new SharedPortfolioManager(
        createPortfolioConfig({ positionSizePercent: 20 }),
        0
      );
      const { exposurePerWatcher, maxTotalExposure } = portfolio.calculateExposureForNewPosition();

      expect(exposurePerWatcher).toBe(20);
      expect(maxTotalExposure).toBe(0);
    });

    it('should calculate position size correctly with multiple watchers', () => {
      const positionSizePercent = 15;
      const activeWatchers = 4;
      const portfolio = new SharedPortfolioManager(
        createPortfolioConfig({ positionSizePercent }),
        activeWatchers
      );

      const { exposurePerWatcher, maxPositionValue, maxTotalExposure } = portfolio.calculateExposureForNewPosition();

      expect(exposurePerWatcher).toBe(positionSizePercent);
      expect(exposurePerWatcher).toBe(15);
      expect(maxPositionValue).toBe(1500);
      expect(maxTotalExposure).toBe(6000);
    });
  });

  describe('Position Management', () => {
    let portfolio: SharedPortfolioManager;

    beforeEach(() => {
      portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
    });

    it('should open a position and track it', () => {
      const setup = createSetup();
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      expect(position.watcherSymbol).toBe('BTCUSDT');
      expect(position.watcherInterval).toBe('4h');
      expect(position.entryPrice).toBe(100);
      expect(position.quantity).toBe(10);
      expect(position.side).toBe('LONG');
      expect(portfolio.getOpenPositions()).toHaveLength(1);
    });

    it('should close a position and calculate PnL', () => {
      const setup = createSetup({ entryPrice: 100 });
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const tradeResult = portfolio.closePosition(
        position.id,
        110,
        Date.now() + 3600000,
        'TAKE_PROFIT',
        2
      );

      expect(tradeResult).toBeDefined();
      expect(tradeResult!.pnl).toBe(100);
      expect(tradeResult!.netPnl).toBe(98);
      expect(tradeResult!.exitReason).toBe('TAKE_PROFIT');
      expect(portfolio.getOpenPositions()).toHaveLength(0);
      expect(portfolio.getClosedTrades()).toHaveLength(1);
    });

    it('should calculate SHORT position PnL correctly', () => {
      const setup = createSetup({ direction: 'SHORT', entryPrice: 100 });
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const tradeResult = portfolio.closePosition(
        position.id,
        90,
        Date.now() + 3600000,
        'TAKE_PROFIT',
        2
      );

      expect(tradeResult!.pnl).toBe(100);
    });

    it('should update equity after closing a position', () => {
      const setup = createSetup({ entryPrice: 100 });
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      portfolio.closePosition(position.id, 110, Date.now() + 3600000, 'TAKE_PROFIT', 2);

      expect(portfolio.getEquity()).toBe(10098);
    });
  });

  describe('Filter Checks', () => {
    let portfolio: SharedPortfolioManager;

    beforeEach(() => {
      portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
    });

    it('should pass max positions check when below limit', () => {
      const result = portfolio.checkMaxPositions();
      expect(result.passed).toBe(true);
    });

    it('should fail max positions check when at limit', () => {
      for (let i = 0; i < 3; i++) {
        const setup = createSetup({ id: `setup-${i}` });
        portfolio.openPosition(setup, `SYMBOL${i}`, '4h', 10, Date.now() + i);
      }

      const result = portfolio.checkMaxPositions();
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Max concurrent positions');
    });

    it('should pass cooldown check when no recent trades', () => {
      const result = portfolio.checkCooldown('larry-williams-9-1', 'BTCUSDT', '4h', Date.now());
      expect(result.passed).toBe(true);
    });

    it('should fail cooldown check when trade too recent', () => {
      const now = Date.now();
      portfolio.setCooldown('larry-williams-9-1', 'BTCUSDT', '4h', now);

      const result = portfolio.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '4h',
        now + 5 * 60 * 1000
      );

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Cooldown active');
    });

    it('should pass cooldown check after cooldown period', () => {
      const now = Date.now();
      portfolio.setCooldown('larry-williams-9-1', 'BTCUSDT', '4h', now);

      const result = portfolio.checkCooldown(
        'larry-williams-9-1',
        'BTCUSDT',
        '4h',
        now + 20 * 60 * 1000
      );

      expect(result.passed).toBe(true);
    });

    it('should fail daily loss limit check when exceeded', () => {
      const setup = createSetup({ entryPrice: 100 });
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 100, Date.now());

      portfolio.closePosition(position.id, 90, Date.now(), 'STOP_LOSS', 5);

      const result = portfolio.checkDailyLossLimit(new Date().toISOString().split('T')[0]!);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Daily loss limit reached');
    });

    it('should fail opposite direction check when position exists', () => {
      const setup = createSetup({ direction: 'LONG' });
      portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const result = portfolio.checkOppositeDirection('BTCUSDT', 'SHORT');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Opposite direction');
    });

    it('should pass opposite direction check for same direction', () => {
      const setup = createSetup({ direction: 'LONG' });
      portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const result = portfolio.checkOppositeDirection('BTCUSDT', 'LONG');
      expect(result.passed).toBe(true);
    });

    it('should fail watcher position limit when watcher has open position', () => {
      const setup = createSetup();
      portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const result = portfolio.checkWatcherPositionLimit('BTCUSDT', '4h');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('already has an open position');
    });

    it('should pass exposure check when within limits', () => {
      const result = portfolio.canOpenPosition(1000);
      expect(result.passed).toBe(true);
    });

    it('should fail exposure check when exceeds limits', () => {
      const { maxTotalExposure } = portfolio.calculateExposureForNewPosition();
      expect(maxTotalExposure).toBe(3000);

      const result = portfolio.canOpenPosition(4000);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('exceed max');
    });
  });

  describe('Risk/Reward Validation', () => {
    let portfolio: SharedPortfolioManager;

    beforeEach(() => {
      portfolio = new SharedPortfolioManager(createPortfolioConfig({ minRiskRewardRatio: 1.5 }), 3);
    });

    it('should pass R:R check for valid setup', () => {
      const setup = createSetup({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 110,
      });

      const result = portfolio.checkRiskReward(setup);
      expect(result.passed).toBe(true);
    });

    it('should fail R:R check for insufficient ratio', () => {
      const setup = createSetup({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 102,
      });

      const result = portfolio.checkRiskReward(setup);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Insufficient R:R');
    });

    it('should fail when stop loss is missing', () => {
      const setup = createSetup({
        entryPrice: 100,
        stopLoss: undefined,
        takeProfit: 110,
      });

      const result = portfolio.checkRiskReward(setup);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Missing stop loss');
    });

    it('should calculate R:R correctly for SHORT', () => {
      const setup = createSetup({
        direction: 'SHORT',
        entryPrice: 100,
        stopLoss: 105,
        takeProfit: 90,
      });

      const result = portfolio.checkRiskReward(setup);
      expect(result.passed).toBe(true);
    });
  });

  describe('runAllFilters', () => {
    it('should pass all filters for valid setup', () => {
      const portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
      const setup = createSetup({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 110,
      });

      const result = portfolio.runAllFilters(setup, 'BTCUSDT', '4h', Date.now(), 1000);

      expect(result.passed).toBe(true);
    });

    it('should fail and return first failing filter', () => {
      const portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
      const setup = createSetup({
        entryPrice: 100,
        stopLoss: undefined,
      });

      const result = portfolio.runAllFilters(setup, 'BTCUSDT', '4h', Date.now(), 1000);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('[riskReward]');
    });
  });

  describe('Portfolio State', () => {
    it('should track drawdown correctly', () => {
      const portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
      const setup = createSetup({ entryPrice: 100 });
      const position = portfolio.openPosition(setup, 'BTCUSDT', '4h', 100, Date.now());

      portfolio.closePosition(position.id, 80, Date.now(), 'STOP_LOSS', 2);

      expect(portfolio.getMaxDrawdown()).toBeGreaterThan(0);
      expect(portfolio.getMaxDrawdownPercent()).toBeCloseTo(20.02, 1);
    });

    it('should provide complete state snapshot', () => {
      const portfolio = new SharedPortfolioManager(createPortfolioConfig(), 3);
      const setup = createSetup();
      portfolio.openPosition(setup, 'BTCUSDT', '4h', 10, Date.now());

      const state = portfolio.getState();

      expect(state.equity).toBe(10000);
      expect(state.peakEquity).toBe(10000);
      expect(state.openPositions).toHaveLength(1);
      expect(state.closedTrades).toBe(0);
      expect(state.currentExposure).toBe(1000);
    });
  });
});
