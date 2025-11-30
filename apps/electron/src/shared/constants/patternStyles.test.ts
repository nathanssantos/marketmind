import { describe, expect, it } from 'vitest';
import type { AIPatternType } from '../types/aiPattern';
import { getPatternStyle, LINE_WIDTHS, OPACITY, PATTERN_COLORS, PATTERN_LABELS } from './patternStyles';

describe('patternStyles', () => {
  describe('getPatternStyle', () => {
    it('should return correct style for support type', () => {
      const result = getPatternStyle('support');

      expect(result).toEqual({
        color: PATTERN_COLORS.support,
        lineStyle: 'solid',
        lineWidth: LINE_WIDTHS.primary,
        opacity: OPACITY.line,
        zoneOpacity: OPACITY.zone,
        category: 'Support & Resistance',
        label: PATTERN_LABELS.support,
      });
    });

    it('should return correct style for resistance type', () => {
      const result = getPatternStyle('resistance');

      expect(result).toEqual({
        color: PATTERN_COLORS.resistance,
        lineStyle: 'solid',
        lineWidth: LINE_WIDTHS.primary,
        opacity: OPACITY.line,
        zoneOpacity: OPACITY.zone,
        category: 'Support & Resistance',
        label: PATTERN_LABELS.resistance,
      });
    });

    it('should return dashed line style for bullish trendline', () => {
      const result = getPatternStyle('trendline-bullish');

      expect(result.lineStyle).toBe('dashed');
      expect(result.color).toBe(PATTERN_COLORS['trendline-bullish']);
      expect(result.category).toBe('Trendlines');
      expect(result.label).toBe('Bullish Trendline');
    });

    it('should return dashed line style for bearish trendline', () => {
      const result = getPatternStyle('trendline-bearish');

      expect(result.lineStyle).toBe('dashed');
      expect(result.color).toBe(PATTERN_COLORS['trendline-bearish']);
      expect(result.category).toBe('Trendlines');
    });

    it('should return dotted line style for fibonacci retracement', () => {
      const result = getPatternStyle('fibonacci-retracement');

      expect(result.lineStyle).toBe('dotted');
      expect(result.color).toBe(PATTERN_COLORS['fibonacci-retracement']);
      expect(result.category).toBe('Fibonacci');
      expect(result.label).toBe('Fibonacci Retracement');
    });

    it('should return dotted line style for fibonacci extension', () => {
      const result = getPatternStyle('fibonacci-extension');

      expect(result.lineStyle).toBe('dotted');
      expect(result.color).toBe(PATTERN_COLORS['fibonacci-extension']);
      expect(result.category).toBe('Fibonacci');
    });

    it('should return dashed line style for gap types', () => {
      const gapTypes: AIPatternType[] = [
        'gap-common',
        'gap-breakaway',
        'gap-runaway',
        'gap-exhaustion',
      ];

      gapTypes.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.lineStyle).toBe('dashed');
        expect(result.category).toBe('Gaps');
      });
    });

    it('should return solid line style for channel types', () => {
      const channelTypes: AIPatternType[] = [
        'channel-ascending',
        'channel-descending',
        'channel-horizontal',
      ];

      channelTypes.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.lineStyle).toBe('solid');
        expect(result.category).toBe('Channels');
      });
    });

    it('should return correct category for reversal patterns', () => {
      const reversalTypes: AIPatternType[] = [
        'head-and-shoulders',
        'inverse-head-and-shoulders',
        'double-top',
        'double-bottom',
        'triple-top',
        'triple-bottom',
        'rounding-bottom',
      ];

      reversalTypes.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.category).toBe('Reversal Patterns');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should return correct category for continuation patterns', () => {
      const continuationTypes: AIPatternType[] = [
        'triangle-ascending',
        'triangle-descending',
        'triangle-symmetrical',
        'wedge-rising',
        'wedge-falling',
        'flag-bullish',
        'flag-bearish',
        'pennant',
        'cup-and-handle',
      ];

      continuationTypes.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.category).toBe('Continuation Patterns');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should return correct category for zone types', () => {
      const zoneTypes: AIPatternType[] = [
        'liquidity-zone',
        'sell-zone',
        'buy-zone',
        'accumulation-zone',
      ];

      zoneTypes.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.category).toBe('Zones');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should include all required properties', () => {
      const result = getPatternStyle('support');

      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('lineStyle');
      expect(result).toHaveProperty('lineWidth');
      expect(result).toHaveProperty('opacity');
      expect(result).toHaveProperty('zoneOpacity');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('label');
    });

    it('should always use primary line width', () => {
      const types: AIPatternType[] = [
        'support',
        'trendline-bullish',
        'fibonacci-retracement',
        'gap-common',
        'head-and-shoulders',
      ];

      types.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.lineWidth).toBe(LINE_WIDTHS.primary);
      });
    });

    it('should always use line opacity', () => {
      const types: AIPatternType[] = [
        'resistance',
        'trendline-bearish',
        'fibonacci-extension',
        'triangle-ascending',
      ];

      types.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.opacity).toBe(OPACITY.line);
      });
    });

    it('should always use zone opacity for zoneOpacity', () => {
      const types: AIPatternType[] = [
        'support',
        'channel-ascending',
        'double-top',
        'gap-breakaway',
      ];

      types.forEach((type) => {
        const result = getPatternStyle(type);
        expect(result.zoneOpacity).toBe(OPACITY.zone);
      });
    });

    it('should handle all pattern types without throwing', () => {
      const allTypes = Object.keys(PATTERN_COLORS) as AIPatternType[];

      allTypes.forEach((type) => {
        expect(() => getPatternStyle(type)).not.toThrow();
        const result = getPatternStyle(type);
        expect(result.color).toBe(PATTERN_COLORS[type]);
        expect(result.label).toBe(PATTERN_LABELS[type]);
      });
    });

    it('should prioritize trendline prefix over other conditions', () => {
      const result = getPatternStyle('trendline-bullish');
      expect(result.lineStyle).toBe('dashed');
    });

    it('should prioritize fibonacci prefix over other conditions', () => {
      const result = getPatternStyle('fibonacci-retracement');
      expect(result.lineStyle).toBe('dotted');
    });

    it('should prioritize gap prefix over other conditions', () => {
      const result = getPatternStyle('gap-common');
      expect(result.lineStyle).toBe('dashed');
    });

    it('should return correct label for each pattern type', () => {
      const tests: [AIPatternType, string][] = [
        ['support', 'Support'],
        ['resistance', 'Resistance'],
        ['trendline-bullish', 'Bullish Trendline'],
        ['fibonacci-retracement', 'Fibonacci Retracement'],
        ['head-and-shoulders', 'Head and Shoulders'],
        ['double-top', 'Double Top'],
        ['triangle-ascending', 'Ascending Triangle'],
        ['gap-common', 'Common Gap'],
      ];

      tests.forEach(([type, expectedLabel]) => {
        const result = getPatternStyle(type);
        expect(result.label).toBe(expectedLabel);
      });
    });
  });
});
