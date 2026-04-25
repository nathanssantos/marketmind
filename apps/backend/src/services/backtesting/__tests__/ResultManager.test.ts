import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import { ResultManager, type SavedBacktestResult, type OptimizationSummary } from '../ResultManager';
import type { BacktestResult, BacktestMetrics, Interval } from '@marketmind/types';

vi.mock('fs/promises');

const createMockMetrics = (): BacktestMetrics => ({
  totalTrades: 50,
  winningTrades: 30,
  losingTrades: 20,
  winRate: 55,
  totalPnl: 1500,
  totalPnlPercent: 15,
  avgPnl: 30,
  avgPnlPercent: 0.6,
  grossWinRate: 55,
  grossProfitFactor: 1.8,
  totalGrossPnl: 1600,
  maxDrawdown: 500,
  maxDrawdownPercent: 5,
  profitFactor: 1.8,
  sharpeRatio: 1.5,
  avgWin: 100,
  avgLoss: 50,
  largestWin: 300,
  largestLoss: 150,
  totalCommission: 100,
  avgTradeDuration: 24,
  avgWinDuration: 30,
  avgLossDuration: 18,
});

const createMockBacktestResult = (): BacktestResult => ({
  id: 'test-result',
  status: 'COMPLETED',
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-03-01T00:00:00Z',
  duration: 1000,
  trades: [
    {
      id: 'trade-1',
      setupType: 'test-setup',
      entryTime: new Date().toISOString(),
      entryPrice: 50000,
      exitTime: new Date(Date.now() + 3600000).toISOString(),
      exitPrice: 50500,
      quantity: 1,
      side: 'LONG' as const,
      pnl: 500,
      pnlPercent: 1,
      exitReason: 'TAKE_PROFIT' as const,
      commission: 10,
      netPnl: 490,
      status: 'CLOSED' as const,
    },
  ],
  metrics: createMockMetrics(),
  equityCurve: [],
  config: {
    symbol: 'BTCUSDT',
    interval: '1d' as Interval,
    startDate: '2024-01-01',
    endDate: '2024-03-01',
    initialCapital: 10000,
    setupTypes: ['test-setup'],
  },
});

describe('ResultManager', () => {
  let resultManager: ResultManager;
  const testBaseDir = '/tmp/test-results';

  beforeEach(() => {
    vi.resetAllMocks();
    resultManager = new ResultManager(testBaseDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveValidation', () => {
    it('should save validation result to correct path', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const filepath = await resultManager.saveValidation(
        'test-strategy',
        'BTCUSDT',
        '1d',
        { startDate: '2024-01-01', endDate: '2024-03-01' },
        createMockBacktestResult()
      );

      expect(filepath).toContain('validations');
      expect(filepath).toContain('test-strategy');
      expect(filepath).toContain('BTCUSDT');
      expect(filepath).toContain('1d');
      expect(filepath).toContain('.json');
      expect(fs.writeFile).toHaveBeenCalledOnce();
    });

    it('should write correct JSON structure', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await resultManager.saveValidation(
        'test-strategy',
        'BTCUSDT',
        '1d',
        { startDate: '2024-01-01', endDate: '2024-03-01' },
        createMockBacktestResult()
      );

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed.type).toBe('validation');
      expect(parsed.strategy).toBe('test-strategy');
      expect(parsed.symbol).toBe('BTCUSDT');
      expect(parsed.interval).toBe('1d');
      expect(parsed.metrics).toBeDefined();
      expect(parsed.result).toBeDefined();
    });
  });

  describe('saveOptimization', () => {
    it('should save optimization result to correct path', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const results = [
        { params: { sl: 2, tp: 4 }, metrics: createMockMetrics() },
        { params: { sl: 3, tp: 6 }, metrics: createMockMetrics() },
      ];

      const statistics = {
        average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 },
      };

      const filepath = await resultManager.saveOptimization(
        'test-strategy',
        'BTCUSDT',
        '1d',
        { startDate: '2024-01-01', endDate: '2024-03-01' },
        results,
        statistics
      );

      expect(filepath).toContain('optimizations');
      expect(filepath).toContain('test-strategy');
      expect(fs.writeFile).toHaveBeenCalledOnce();
    });

    it('should save only top 10 results', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const results = Array.from({ length: 20 }, (_, i) => ({
        params: { param: i },
        metrics: createMockMetrics(),
      }));

      await resultManager.saveOptimization(
        'test-strategy',
        'BTCUSDT',
        '1d',
        { startDate: '2024-01-01', endDate: '2024-03-01' },
        results,
        { average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 } }
      );

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed.topResults).toHaveLength(10);
      expect(parsed.totalCombinations).toBe(20);
    });
  });

  describe('load', () => {
    it('should load and parse JSON file', async () => {
      const mockData: SavedBacktestResult = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'validation',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        config: {},
        result: createMockBacktestResult(),
        metrics: createMockMetrics(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));

      const loaded = await resultManager.load('/path/to/file.json');

      expect(loaded.type).toBe('validation');
      expect(loaded.strategy).toBe('test');
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.json', 'utf-8');
    });
  });

  describe('listValidations', () => {
    it('should list validation files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'test1.json',
        'test2.json',
        'readme.txt',
      ] as unknown as any);

      const files = await resultManager.listValidations();

      expect(files).toHaveLength(2);
      expect(files[0]).toContain('test1.json');
      expect(files[1]).toContain('test2.json');
    });

    it('should return empty array if directory does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

      const files = await resultManager.listValidations();

      expect(files).toEqual([]);
    });
  });

  describe('listOptimizations', () => {
    it('should list optimization files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'opt1.json',
        'opt2.json',
      ] as unknown as any);

      const files = await resultManager.listOptimizations();

      expect(files).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));

      const files = await resultManager.listOptimizations();

      expect(files).toEqual([]);
    });
  });

  describe('exportToCSV', () => {
    it('should generate CSV with trades and summary', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const savedResult: SavedBacktestResult = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'validation',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        config: { initialCapital: 10000 },
        result: createMockBacktestResult(),
        metrics: createMockMetrics(),
      };

      await resultManager.exportToCSV(savedResult, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;

      expect(writtenContent).toContain('Trade,Type,Entry Date');
      expect(writtenContent).toContain('Summary');
      expect(writtenContent).toContain('Total Trades');
      expect(writtenContent).toContain('Win Rate');
      expect(writtenContent).toContain('Profit Factor');
    });
  });

  describe('exportOptimizationToCSV', () => {
    it('should generate CSV with optimization results', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const summary: OptimizationSummary = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'optimization',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        totalCombinations: 100,
        successfulRuns: 95,
        topResults: [
          { params: { sl: 2, tp: 4 }, metrics: createMockMetrics() },
          { params: { sl: 3, tp: 6 }, metrics: createMockMetrics() },
        ],
        statistics: {
          average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 },
        },
      };

      await resultManager.exportOptimizationToCSV(summary, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;

      expect(writtenContent).toContain('Rank');
      expect(writtenContent).toContain('sl');
      expect(writtenContent).toContain('tp');
      expect(writtenContent).toContain('Statistics');
      expect(writtenContent).toContain('Total Combinations,100');
    });
  });

  describe('saveWalkForward', () => {
    it('should save walk-forward result and create directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = { windows: [], aggregatedMetrics: {} };
      const filepath = await resultManager.saveWalkForward('test', 'BTCUSDT', '1d', result);

      expect(filepath).toContain('walkforward');
      expect(filepath).toContain('_wf_');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('saveMonteCarlo', () => {
    it('should save Monte Carlo result and create directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = { simulations: [], statistics: {} };
      const filepath = await resultManager.saveMonteCarlo('test', 'BTCUSDT', '1d', result);

      expect(filepath).toContain('montecarlo');
      expect(filepath).toContain('_mc_');
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });

  describe('saveSensitivity', () => {
    it('should save sensitivity result and create directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = { parameterAnalyses: [], robustnessScore: 80 };
      const filepath = await resultManager.saveSensitivity('test', 'BTCUSDT', '1d', result);

      expect(filepath).toContain('sensitivity');
      expect(filepath).toContain('_sensitivity_');
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });

  describe('saveRobustnessValidation', () => {
    it('should save robustness validation result', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = { isRobust: true, degradation: 0.1 };
      const filepath = await resultManager.saveRobustnessValidation(result);

      expect(filepath).toContain('robustness');
      expect(filepath).toContain('robustness_validation_');
      expect(fs.mkdir).toHaveBeenCalled();
    });
  });

  describe('compareResults', () => {
    it('should compare validation results', () => {
      const results: SavedBacktestResult[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'validation',
          strategy: 'strategy-a',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          config: {},
          result: createMockBacktestResult(),
          metrics: { ...createMockMetrics(), winRate: 60, totalPnlPercent: 20 },
        },
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'validation',
          strategy: 'strategy-b',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          config: {},
          result: createMockBacktestResult(),
          metrics: { ...createMockMetrics(), winRate: 50, totalPnlPercent: 10 },
        },
      ];

      const comparison = resultManager.compareResults(results);

      expect(comparison).toHaveLength(2);
      expect(comparison[0]!.strategy).toBe('strategy-a');
      expect(comparison[0]!.winRate).toBe(60);
      expect(comparison[1]!.winRate).toBe(50);
    });

    it('should compare optimization results', () => {
      const results: OptimizationSummary[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'optimization',
          strategy: 'opt-a',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          totalCombinations: 100,
          successfulRuns: 95,
          topResults: [{ params: { sl: 2 }, metrics: createMockMetrics() }],
          statistics: {
            average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 },
          },
        },
      ];

      const comparison = resultManager.compareResults(results);

      expect(comparison).toHaveLength(1);
      expect(comparison[0]!.type).toBe('optimization');
      expect(comparison[0]!.combinations).toBe(100);
      expect(comparison[0]!.avgWinRate).toBe(55);
    });

    it('should handle mixed results', () => {
      const results = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'validation' as const,
          strategy: 'val-a',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          config: {},
          result: createMockBacktestResult(),
          metrics: createMockMetrics(),
        },
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'optimization' as const,
          strategy: 'opt-a',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          totalCombinations: 100,
          successfulRuns: 95,
          topResults: [{ params: { sl: 2 }, metrics: createMockMetrics() }],
          statistics: {
            average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 },
          },
        },
      ];

      const comparison = resultManager.compareResults(results);

      expect(comparison).toHaveLength(2);
      expect(comparison[0]!.type).toBe('validation');
      expect(comparison[1]!.type).toBe('optimization');
    });
  });

  describe('list methods', () => {
    it('should list walkforward results', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['wf1.json'] as unknown as any);
      const files = await resultManager.listWalkForward();
      expect(files).toHaveLength(1);
    });

    it('should list montecarlo results', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['mc1.json'] as unknown as any);
      const files = await resultManager.listMonteCarlo();
      expect(files).toHaveLength(1);
    });

    it('should list sensitivity results', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['sens1.json'] as unknown as any);
      const files = await resultManager.listSensitivity();
      expect(files).toHaveLength(1);
    });

    it('should list robustness results', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['robust1.json'] as unknown as any);
      const files = await resultManager.listRobustnessValidations();
      expect(files).toHaveLength(1);
    });

    it('should return empty array when walkforward directory does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
      const files = await resultManager.listWalkForward();
      expect(files).toEqual([]);
    });

    it('should return empty array when montecarlo directory does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
      const files = await resultManager.listMonteCarlo();
      expect(files).toEqual([]);
    });

    it('should return empty array when sensitivity directory does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
      const files = await resultManager.listSensitivity();
      expect(files).toEqual([]);
    });

    it('should return empty array when robustness directory does not exist', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
      const files = await resultManager.listRobustnessValidations();
      expect(files).toEqual([]);
    });
  });

  describe('constructor default baseDir', () => {
    it('should use default baseDir when none is provided', () => {
      const defaultManager = new ResultManager();
      expect(defaultManager).toBeInstanceOf(ResultManager);
    });
  });

  describe('exportToCSV branch coverage', () => {
    it('should handle trades with no exitTime, exitPrice, exitReason, pnl, pnlPercent, or netPnl', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const savedResult: SavedBacktestResult = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'validation',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        config: { initialCapital: 10000 },
        result: {
          ...createMockBacktestResult(),
          trades: [
            {
              id: 'trade-open',
              setupType: 'test-setup',
              entryTime: '2024-01-15T00:00:00Z',
              entryPrice: 50000,
              exitTime: undefined as any,
              exitPrice: undefined as any,
              quantity: 1,
              side: undefined as any,
              pnl: undefined as any,
              pnlPercent: undefined as any,
              exitReason: undefined as any,
              commission: 5,
              netPnl: undefined as any,
              status: 'OPEN' as const,
            },
          ],
        },
        metrics: createMockMetrics(),
      };

      await resultManager.exportToCSV(savedResult, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      const lines = writtenContent.split('\n');
      const tradeLine = lines[1];

      expect(tradeLine).toContain('UNKNOWN');
      expect(tradeLine).toContain('0.00');
    });

    it('should use tradeData.type when side is not present', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const savedResult: SavedBacktestResult = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'validation',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        config: { initialCapital: 10000 },
        result: {
          ...createMockBacktestResult(),
          trades: [
            {
              id: 'trade-type-fallback',
              setupType: 'test-setup',
              entryTime: '2024-01-15T00:00:00Z',
              entryPrice: 50000,
              exitTime: '2024-01-16T00:00:00Z',
              exitPrice: 50500,
              quantity: 1,
              side: undefined as any,
              type: 'BUY',
              pnl: 500,
              pnlPercent: 1,
              exitReason: 'TAKE_PROFIT' as const,
              commission: 5,
              netPnl: 495,
              status: 'CLOSED' as const,
            } as any,
          ],
        },
        metrics: createMockMetrics(),
      };

      await resultManager.exportToCSV(savedResult, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      const lines = writtenContent.split('\n');
      const tradeLine = lines[1];

      expect(tradeLine).toContain('BUY');
    });

    it('should handle sharpeRatio being 0 or undefined in summary', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const metricsNoSharpe = { ...createMockMetrics(), sharpeRatio: 0 };

      const savedResult: SavedBacktestResult = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'validation',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        config: { initialCapital: 10000 },
        result: createMockBacktestResult(),
        metrics: metricsNoSharpe,
      };

      await resultManager.exportToCSV(savedResult, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('Sharpe Ratio,0.00');
    });
  });

  describe('exportOptimizationToCSV branch coverage', () => {
    it('should handle empty topResults array (no firstResult)', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const summary: OptimizationSummary = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'optimization',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        totalCombinations: 0,
        successfulRuns: 0,
        topResults: [],
        statistics: {
          average: { winRate: 0, totalPnlPercent: 0, profitFactor: 0, sharpeRatio: 0 },
        },
      };

      await resultManager.exportOptimizationToCSV(summary, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;

      expect(writtenContent).toContain('Rank,');
      expect(writtenContent).toContain('Trades,Win Rate');
      expect(writtenContent).toContain('Total Combinations,0');
      expect(writtenContent).not.toContain('sl');
    });

    it('should handle sharpeRatio being 0 in optimization results', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const metricsNoSharpe = { ...createMockMetrics(), sharpeRatio: 0 };

      const summary: OptimizationSummary = {
        timestamp: '2024-01-01T00:00:00Z',
        type: 'optimization',
        strategy: 'test',
        symbol: 'BTCUSDT',
        interval: '1d',
        period: { start: '2024-01-01', end: '2024-03-01' },
        totalCombinations: 1,
        successfulRuns: 1,
        topResults: [{ params: { sl: 2 }, metrics: metricsNoSharpe }],
        statistics: {
          average: { winRate: 55, totalPnlPercent: 15, profitFactor: 1.8, sharpeRatio: 1.5 },
        },
      };

      await resultManager.exportOptimizationToCSV(summary, '/path/to/output.csv');

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain('0.00');
    });
  });

  describe('compareResults branch coverage', () => {
    it('should handle optimization result with empty topResults (no best)', () => {
      const results: OptimizationSummary[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'optimization',
          strategy: 'opt-empty',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          totalCombinations: 0,
          successfulRuns: 0,
          topResults: [],
          statistics: {
            average: { winRate: 0, totalPnlPercent: 0, profitFactor: 0, sharpeRatio: 0 },
          },
        },
      ];

      const comparison = resultManager.compareResults(results);

      expect(comparison).toHaveLength(1);
      const first = comparison[0]!;
      expect(first.type).toBe('optimization');
      expect(first.bestWinRate).toBe(0);
      expect(first.bestProfitFactor).toBe(0);
      expect(first.bestPnl).toBe(0);
    });

    it('should handle validation result with sharpeRatio of 0', () => {
      const metricsNoSharpe = { ...createMockMetrics(), sharpeRatio: 0 };

      const results: SavedBacktestResult[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          type: 'validation',
          strategy: 'strategy-no-sharpe',
          symbol: 'BTCUSDT',
          interval: '1d',
          period: { start: '2024-01-01', end: '2024-03-01' },
          config: {},
          result: createMockBacktestResult(),
          metrics: metricsNoSharpe,
        },
      ];

      const comparison = resultManager.compareResults(results);

      expect(comparison).toHaveLength(1);
      expect(comparison[0]!.sharpeRatio).toBe(0);
    });
  });
});
