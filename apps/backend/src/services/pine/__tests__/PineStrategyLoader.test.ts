import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PineStrategyLoader } from '../PineStrategyLoader';

const STRATEGIES_DIR = join(__dirname, '../../../../strategies/builtin');

const SAMPLE_PINE = `// @id test-strategy
// @name Test Strategy
// @version 2.0.0
// @description A test strategy for unit testing
// @author TestAuthor
// @tags trend,test,sample
// @param period SMA period
// @param multiplier ATR multiplier

//@version=5
indicator('Test Strategy', overlay=true)

period = input.int(20, 'Period')
multiplier = input.float(2.5, 'Multiplier')

smaVal = ta.sma(close, period)
plot(0, 'signal', display=display.none)
`;

describe('PineStrategyLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pine-test-'));
  });

  describe('loadFile', () => {
    it('should load and parse a .pine file', async () => {
      const filePath = join(tempDir, 'test-strategy.pine');
      await writeFile(filePath, SAMPLE_PINE);

      const loader = new PineStrategyLoader([tempDir]);
      const strategy = await loader.loadFile(filePath);

      expect(strategy.metadata.id).toBe('test-strategy');
      expect(strategy.metadata.name).toBe('Test Strategy');
      expect(strategy.metadata.version).toBe('2.0.0');
      expect(strategy.metadata.description).toBe('A test strategy for unit testing');
      expect(strategy.metadata.author).toBe('TestAuthor');
      expect(strategy.metadata.tags).toEqual(['trend', 'test', 'sample']);
      expect(strategy.source).toBe(SAMPLE_PINE);
      expect(strategy.filePath).toBe(filePath);
    });

    it('should extract input defaults from source code', async () => {
      const filePath = join(tempDir, 'test-strategy.pine');
      await writeFile(filePath, SAMPLE_PINE);

      const loader = new PineStrategyLoader([tempDir]);
      const strategy = await loader.loadFile(filePath);

      expect(strategy.metadata.parameters['period']).toBeDefined();
      expect(strategy.metadata.parameters['period']!.default).toBe(20);
      expect(strategy.metadata.parameters['period']!.description).toBe('SMA period');

      expect(strategy.metadata.parameters['multiplier']).toBeDefined();
      expect(strategy.metadata.parameters['multiplier']!.default).toBe(2.5);
    });

    it('should use filename as id when @id is missing', async () => {
      const source = `//@version=5
indicator('No ID', overlay=true)
plot(0, 'signal')
`;
      const filePath = join(tempDir, 'my-strategy.pine');
      await writeFile(filePath, source);

      const loader = new PineStrategyLoader([tempDir]);
      const strategy = await loader.loadFile(filePath);

      expect(strategy.metadata.id).toBe('my-strategy');
    });
  });

  describe('loadFromString', () => {
    it('should parse Pine source from string', () => {
      const loader = new PineStrategyLoader([]);
      const strategy = loader.loadFromString(SAMPLE_PINE);

      expect(strategy.metadata.id).toBe('test-strategy');
      expect(strategy.metadata.name).toBe('Test Strategy');
      expect(strategy.filePath).toBe('inline');
    });

    it('should override id when provided', () => {
      const loader = new PineStrategyLoader([]);
      const strategy = loader.loadFromString(SAMPLE_PINE, 'custom-id');

      expect(strategy.metadata.id).toBe('custom-id');
    });
  });

  describe('loadAll', () => {
    it('should load all .pine files from directory', async () => {
      await writeFile(join(tempDir, 'a.pine'), SAMPLE_PINE);
      await writeFile(
        join(tempDir, 'b.pine'),
        SAMPLE_PINE.replace('test-strategy', 'b-strategy')
      );
      await writeFile(join(tempDir, 'not-pine.json'), '{}');

      const loader = new PineStrategyLoader([tempDir]);
      const strategies = await loader.loadAll();

      expect(strategies.length).toBe(2);
      expect(strategies.map((s) => s.filePath).every((p) => p.endsWith('.pine'))).toBe(
        true
      );
    });

    it('should load from multiple directories', async () => {
      const tempDir2 = await mkdtemp(join(tmpdir(), 'pine-test2-'));
      await writeFile(join(tempDir, 'a.pine'), SAMPLE_PINE);
      await writeFile(join(tempDir2, 'b.pine'), SAMPLE_PINE);

      const loader = new PineStrategyLoader([tempDir, tempDir2]);
      const strategies = await loader.loadAll();

      expect(strategies.length).toBe(2);
      await rm(tempDir2, { recursive: true });
    });
  });

  describe('loadAllCached', () => {
    it('should return cached results on second call', async () => {
      await writeFile(join(tempDir, 'a.pine'), SAMPLE_PINE);

      const loader = new PineStrategyLoader([tempDir]);
      const first = await loader.loadAllCached();
      const second = await loader.loadAllCached();

      expect(first.length).toBe(1);
      expect(second.length).toBe(1);
      expect(first[0]!.metadata.id).toBe(second[0]!.metadata.id);
    });
  });

  describe('getById', () => {
    it('should return cached strategy by id', async () => {
      await writeFile(join(tempDir, 'test.pine'), SAMPLE_PINE);

      const loader = new PineStrategyLoader([tempDir]);
      await loader.loadAllCached();

      const found = loader.getById('test-strategy');
      expect(found).toBeDefined();
      expect(found!.metadata.name).toBe('Test Strategy');

      const notFound = loader.getById('nonexistent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('builtin strategies', () => {
    it('should load real .pine strategy files from strategies/builtin/', async () => {
      const loader = new PineStrategyLoader([STRATEGIES_DIR]);
      const strategies = await loader.loadAll();

      const pineStrategies = strategies.filter(
        (s) => s.filePath.endsWith('.pine')
      );
      expect(pineStrategies.length).toBeGreaterThanOrEqual(3);

      const ids = pineStrategies.map((s) => s.metadata.id);
      expect(ids).toContain('golden-cross-sma');
      expect(ids).toContain('nr7-breakout');
      expect(ids).toContain('hull-ma-trend');
    });

    it('should extract correct metadata from golden-cross-sma.pine', async () => {
      const loader = new PineStrategyLoader([STRATEGIES_DIR]);
      const strategy = await loader.loadFile(
        join(STRATEGIES_DIR, 'golden-cross-sma.pine')
      );

      expect(strategy.metadata.id).toBe('golden-cross-sma');
      expect(strategy.metadata.name).toBe('Golden Cross SMA 50/200');
      expect(strategy.metadata.author).toBe('MarketMind');
      expect(strategy.metadata.tags).toContain('trend-following');
      expect(strategy.metadata.tags).toContain('golden-cross');
      expect(strategy.metadata.parameters['fastPeriod']!.default).toBe(50);
      expect(strategy.metadata.parameters['slowPeriod']!.default).toBe(200);
      expect(strategy.metadata.parameters['atrMultiplier']!.default).toBe(3.0);
    });
  });
});
