import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ResultManager, type SavedBacktestResult, type OptimizationSummary } from '../ResultManager';
import type { BacktestResult, BacktestMetrics, Interval } from '@marketmind/types';

vi.mock('fs/promises');

const createMockMetrics = (): BacktestMetrics => ({
  totalTrades: 50,
  winRate: 55,
  totalPnl: 1500,
  totalPnlPercent: 15,
  maxDrawdown: 500,
  maxDrawdownPercent: 5,
  profitFactor: 1.8,
  sharpeRatio: 1.5,
  avgWin: 100,
  avgLoss: 50,
  avgWinPercent: 2,
  avgLossPercent: 1,
  largestWin: 300,
  largestLoss: 150,
  avgTradeDuration: 24,
  avgBarsInTrade: 6,
});

const createMockBacktestResult = (): BacktestResult => ({
  id: 'test-result',
  status: 'SUCCESS',
  startDate: '2024-01-01',
  endDate: '2024-03-01',
  trades: [
    {
      id: 'trade-1',
      setupType: 'test-setup',
      symbol: 'BTCUSDT',
      entryTime: Date.now(),
      entryPrice: 50000,
      exitTime: Date.now() + 3600000,
      exitPrice: 50500,
      quantity: 1,
      side: 'LONG' as const,
      pnl: 500,
      pnlPercent: 1,
      exitReason: 'takeProfit',
      commission: 10,
      netPnl: 490,
    },
  ],
  metrics: createMockMetrics(),
  equityCurve: [],
  drawdownCurve: [],
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
      expect(comparison[0].strategy).toBe('strategy-a');
      expect(comparison[0].winRate).toBe(60);
      expect(comparison[1].winRate).toBe(50);
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
      expect(comparison[0].type).toBe('optimization');
      expect(comparison[0].combinations).toBe(100);
      expect(comparison[0].avgWinRate).toBe(55);
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
      expect(comparison[0].type).toBe('validation');
      expect(comparison[1].type).toBe('optimization');
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
  });
});
