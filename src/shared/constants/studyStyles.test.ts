import { describe, expect, it } from 'vitest';
import type { AIStudyType } from '../types/aiStudy';
import { getStudyStyle, LINE_WIDTHS, OPACITY, STUDY_COLORS, STUDY_LABELS } from './studyStyles';

describe('studyStyles', () => {
  describe('getStudyStyle', () => {
    it('should return correct style for support type', () => {
      const result = getStudyStyle('support');

      expect(result).toEqual({
        color: STUDY_COLORS.support,
        lineStyle: 'solid',
        lineWidth: LINE_WIDTHS.primary,
        opacity: OPACITY.line,
        zoneOpacity: OPACITY.zone,
        category: 'Support & Resistance',
        label: STUDY_LABELS.support,
      });
    });

    it('should return correct style for resistance type', () => {
      const result = getStudyStyle('resistance');

      expect(result).toEqual({
        color: STUDY_COLORS.resistance,
        lineStyle: 'solid',
        lineWidth: LINE_WIDTHS.primary,
        opacity: OPACITY.line,
        zoneOpacity: OPACITY.zone,
        category: 'Support & Resistance',
        label: STUDY_LABELS.resistance,
      });
    });

    it('should return dashed line style for bullish trendline', () => {
      const result = getStudyStyle('trendline-bullish');

      expect(result.lineStyle).toBe('dashed');
      expect(result.color).toBe(STUDY_COLORS['trendline-bullish']);
      expect(result.category).toBe('Trendlines');
      expect(result.label).toBe('Bullish Trendline');
    });

    it('should return dashed line style for bearish trendline', () => {
      const result = getStudyStyle('trendline-bearish');

      expect(result.lineStyle).toBe('dashed');
      expect(result.color).toBe(STUDY_COLORS['trendline-bearish']);
      expect(result.category).toBe('Trendlines');
    });

    it('should return dotted line style for fibonacci retracement', () => {
      const result = getStudyStyle('fibonacci-retracement');

      expect(result.lineStyle).toBe('dotted');
      expect(result.color).toBe(STUDY_COLORS['fibonacci-retracement']);
      expect(result.category).toBe('Fibonacci');
      expect(result.label).toBe('Fibonacci Retracement');
    });

    it('should return dotted line style for fibonacci extension', () => {
      const result = getStudyStyle('fibonacci-extension');

      expect(result.lineStyle).toBe('dotted');
      expect(result.color).toBe(STUDY_COLORS['fibonacci-extension']);
      expect(result.category).toBe('Fibonacci');
    });

    it('should return dashed line style for gap types', () => {
      const gapTypes: AIStudyType[] = [
        'gap-common',
        'gap-breakaway',
        'gap-runaway',
        'gap-exhaustion',
      ];

      gapTypes.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.lineStyle).toBe('dashed');
        expect(result.category).toBe('Gaps');
      });
    });

    it('should return solid line style for channel types', () => {
      const channelTypes: AIStudyType[] = [
        'channel-ascending',
        'channel-descending',
        'channel-horizontal',
      ];

      channelTypes.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.lineStyle).toBe('solid');
        expect(result.category).toBe('Channels');
      });
    });

    it('should return correct category for reversal patterns', () => {
      const reversalTypes: AIStudyType[] = [
        'head-and-shoulders',
        'inverse-head-and-shoulders',
        'double-top',
        'double-bottom',
        'triple-top',
        'triple-bottom',
        'rounding-bottom',
      ];

      reversalTypes.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.category).toBe('Reversal Patterns');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should return correct category for continuation patterns', () => {
      const continuationTypes: AIStudyType[] = [
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
        const result = getStudyStyle(type);
        expect(result.category).toBe('Continuation Patterns');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should return correct category for zone types', () => {
      const zoneTypes: AIStudyType[] = [
        'liquidity-zone',
        'sell-zone',
        'buy-zone',
        'accumulation-zone',
      ];

      zoneTypes.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.category).toBe('Zones');
        expect(result.lineStyle).toBe('solid');
      });
    });

    it('should include all required properties', () => {
      const result = getStudyStyle('support');

      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('lineStyle');
      expect(result).toHaveProperty('lineWidth');
      expect(result).toHaveProperty('opacity');
      expect(result).toHaveProperty('zoneOpacity');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('label');
    });

    it('should always use primary line width', () => {
      const types: AIStudyType[] = [
        'support',
        'trendline-bullish',
        'fibonacci-retracement',
        'gap-common',
        'head-and-shoulders',
      ];

      types.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.lineWidth).toBe(LINE_WIDTHS.primary);
      });
    });

    it('should always use line opacity', () => {
      const types: AIStudyType[] = [
        'resistance',
        'trendline-bearish',
        'fibonacci-extension',
        'triangle-ascending',
      ];

      types.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.opacity).toBe(OPACITY.line);
      });
    });

    it('should always use zone opacity for zoneOpacity', () => {
      const types: AIStudyType[] = [
        'support',
        'channel-ascending',
        'double-top',
        'gap-breakaway',
      ];

      types.forEach((type) => {
        const result = getStudyStyle(type);
        expect(result.zoneOpacity).toBe(OPACITY.zone);
      });
    });

    it('should handle all study types without throwing', () => {
      const allTypes = Object.keys(STUDY_COLORS) as AIStudyType[];

      allTypes.forEach((type) => {
        expect(() => getStudyStyle(type)).not.toThrow();
        const result = getStudyStyle(type);
        expect(result.color).toBe(STUDY_COLORS[type]);
        expect(result.label).toBe(STUDY_LABELS[type]);
      });
    });

    it('should prioritize trendline prefix over other conditions', () => {
      const result = getStudyStyle('trendline-bullish');
      expect(result.lineStyle).toBe('dashed');
    });

    it('should prioritize fibonacci prefix over other conditions', () => {
      const result = getStudyStyle('fibonacci-retracement');
      expect(result.lineStyle).toBe('dotted');
    });

    it('should prioritize gap prefix over other conditions', () => {
      const result = getStudyStyle('gap-common');
      expect(result.lineStyle).toBe('dashed');
    });

    it('should return correct label for each study type', () => {
      const tests: [AIStudyType, string][] = [
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
        const result = getStudyStyle(type);
        expect(result.label).toBe(expectedLabel);
      });
    });
  });
});
