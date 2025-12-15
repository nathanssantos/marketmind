import type { AIPatternType } from '@marketmind/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePatternDetectionConfigStore } from './patternDetectionConfigStore';

const DEFAULT_ENABLED_PATTERNS: AIPatternType[] = [
  'head-and-shoulders',
  'inverse-head-and-shoulders',
  'double-top',
  'double-bottom',
  'triple-top',
  'triple-bottom',
  'triangle-ascending',
  'triangle-descending',
  'triangle-symmetrical',
  'flag-bullish',
  'flag-bearish',
  'pennant',
  'cup-and-handle',
  'rounding-bottom',
  'wedge-falling',
  'wedge-rising',
  'support',
  'resistance',
  'buy-zone',
  'sell-zone',
  'liquidity-zone',
  'accumulation-zone',
  'gap-common',
  'gap-breakaway',
  'gap-runaway',
  'gap-exhaustion',
];

describe('patternDetectionConfigStore', () => {
  beforeEach(() => {
    usePatternDetectionConfigStore.setState({
      config: {
        sensitivity: 50,
        minConfidence: 0.5,
        formationPeriod: 50,
        trendlineR2Threshold: 0.85,
        volumeConfirmationWeight: 0.3,
        enabledPatterns: [...DEFAULT_ENABLED_PATTERNS],
        showPreview: true,
        filteringMode: 'clean',
        maxPatternsTotal: 20,
        enableNestedFiltering: false,
        enableOverlapFiltering: false,
        overlapThreshold: 0.6,
        highlightConflicts: true,
        showChannelCenterline: true,
        showExtensions: true,
        extendTrendlines: true,
        extendChannels: true,
        extendSupport: true,
        extendResistance: true,
        maxPatternsPerTier: {
          macro: 10,
          major: 8,
          intermediate: 6,
          minor: 4,
        },
        maxPatternsPerCategory: 5,
      },
    });
  });

  describe('Initial State', () => {
    it('should have default sensitivity', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.sensitivity).toBe(50);
    });

    it('should have default minConfidence', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.minConfidence).toBe(0.5);
    });

    it('should have default formationPeriod', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.formationPeriod).toBe(50);
    });

    it('should have default trendlineR2Threshold', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.trendlineR2Threshold).toBe(0.85);
    });

    it('should have default volumeConfirmationWeight', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.volumeConfirmationWeight).toBe(0.3);
    });

    it('should have default enabled patterns', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).toEqual(DEFAULT_ENABLED_PATTERNS);
    });

    it('should have showPreview enabled by default', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.showPreview).toBe(true);
    });

    it('should have clean filtering mode by default', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.filteringMode).toBe('clean');
    });

    it('should have default maxPatternsTotal', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.maxPatternsTotal).toBe(20);
    });

    it('should have default maxPatternsPerTier', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.maxPatternsPerTier).toEqual({
        macro: 10,
        major: 8,
        intermediate: 6,
        minor: 4,
      });
    });

    it('should have extension settings enabled by default', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.extendTrendlines).toBe(true);
      expect(config.extendChannels).toBe(true);
      expect(config.extendSupport).toBe(true);
      expect(config.extendResistance).toBe(true);
    });
  });

  describe('setConfig', () => {
    it('should update sensitivity', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ sensitivity: 75 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.sensitivity).toBe(75);
    });

    it('should update minConfidence', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ minConfidence: 0.7 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.minConfidence).toBe(0.7);
    });

    it('should update formationPeriod', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ formationPeriod: 100 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.formationPeriod).toBe(100);
    });

    it('should update filteringMode', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ filteringMode: 'complete' });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.filteringMode).toBe('complete');
    });

    it('should update maxPatternsTotal', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ maxPatternsTotal: 30 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.maxPatternsTotal).toBe(30);
    });

    it('should update maxPatternsPerTier', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({
        maxPatternsPerTier: {
          macro: 15,
          major: 12,
          intermediate: 8,
          minor: 5,
        },
      });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.maxPatternsPerTier).toEqual({
        macro: 15,
        major: 12,
        intermediate: 8,
        minor: 5,
      });
    });

    it('should update nested filtering setting', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ enableNestedFiltering: true });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enableNestedFiltering).toBe(true);
    });

    it('should update overlap filtering setting', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ enableOverlapFiltering: true, overlapThreshold: 0.8 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enableOverlapFiltering).toBe(true);
      expect(config.overlapThreshold).toBe(0.8);
    });

    it('should update extension settings', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({
        extendTrendlines: false,
        extendChannels: false,
      });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.extendTrendlines).toBe(false);
      expect(config.extendChannels).toBe(false);
    });

    it('should preserve other values when updating partial config', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ sensitivity: 80 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.sensitivity).toBe(80);
      expect(config.minConfidence).toBe(0.5);
      expect(config.formationPeriod).toBe(50);
    });

    it('should allow multiple partial updates', () => {
      const { setConfig } = usePatternDetectionConfigStore.getState();
      setConfig({ sensitivity: 60 });
      setConfig({ minConfidence: 0.6 });
      setConfig({ formationPeriod: 75 });

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.sensitivity).toBe(60);
      expect(config.minConfidence).toBe(0.6);
      expect(config.formationPeriod).toBe(75);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all config to defaults', () => {
      const { setConfig, resetToDefaults } = usePatternDetectionConfigStore.getState();

      setConfig({
        sensitivity: 80,
        minConfidence: 0.9,
        formationPeriod: 100,
        filteringMode: 'complete',
      });

      resetToDefaults();

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.sensitivity).toBe(50);
      expect(config.minConfidence).toBe(0.5);
      expect(config.formationPeriod).toBe(50);
      expect(config.filteringMode).toBe('clean');
    });

    it('should restore default enabled patterns', () => {
      const { setConfig, resetToDefaults } = usePatternDetectionConfigStore.getState();

      setConfig({ enabledPatterns: ['support'] });
      resetToDefaults();

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).toEqual(DEFAULT_ENABLED_PATTERNS);
    });
  });

  describe('togglePattern', () => {
    it('should disable an enabled pattern', () => {
      const { togglePattern } = usePatternDetectionConfigStore.getState();

      togglePattern('support');

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).not.toContain('support');
    });

    it('should enable a disabled pattern', () => {
      const { setConfig, togglePattern } = usePatternDetectionConfigStore.getState();

      setConfig({ enabledPatterns: [] });
      togglePattern('support');

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).toContain('support');
    });

    it('should toggle pattern multiple times', () => {
      const { togglePattern } = usePatternDetectionConfigStore.getState();

      togglePattern('support');
      let { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).not.toContain('support');

      togglePattern('support');
      config = usePatternDetectionConfigStore.getState().config;
      expect(config.enabledPatterns).toContain('support');
    });

    it('should preserve other enabled patterns when toggling', () => {
      const { togglePattern } = usePatternDetectionConfigStore.getState();

      togglePattern('support');

      const { config } = usePatternDetectionConfigStore.getState();
      expect(config.enabledPatterns).toContain('resistance');
      expect(config.enabledPatterns).toContain('double-top');
    });
  });

  describe('isPatternEnabled', () => {
    it('should return true for enabled pattern', () => {
      const { isPatternEnabled } = usePatternDetectionConfigStore.getState();
      expect(isPatternEnabled('support')).toBe(true);
    });

    it('should return false for disabled pattern', () => {
      const { setConfig, isPatternEnabled } = usePatternDetectionConfigStore.getState();

      setConfig({ enabledPatterns: [] });

      const { isPatternEnabled: check } = usePatternDetectionConfigStore.getState();
      expect(check('support')).toBe(false);
    });

    it('should reflect toggle changes', () => {
      const { togglePattern, isPatternEnabled } = usePatternDetectionConfigStore.getState();

      expect(isPatternEnabled('support')).toBe(true);

      togglePattern('support');

      const { isPatternEnabled: checkAfterToggle } = usePatternDetectionConfigStore.getState();
      expect(checkAfterToggle('support')).toBe(false);
    });
  });

  describe('Store Function Existence', () => {
    it('should expose all functions', () => {
      const state = usePatternDetectionConfigStore.getState();
      expect(typeof state.setConfig).toBe('function');
      expect(typeof state.resetToDefaults).toBe('function');
      expect(typeof state.togglePattern).toBe('function');
      expect(typeof state.isPatternEnabled).toBe('function');
    });

    it('should expose config object', () => {
      const { config } = usePatternDetectionConfigStore.getState();
      expect(config).toBeDefined();
      expect(typeof config.sensitivity).toBe('number');
      expect(typeof config.enabledPatterns).toBe('object');
    });
  });
});
