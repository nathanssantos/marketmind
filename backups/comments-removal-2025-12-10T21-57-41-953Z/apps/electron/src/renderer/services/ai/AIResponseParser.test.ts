import type { AIPattern } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAIResponse, validateAIPattern } from './AIResponseParser';

describe('AIResponseParser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse response with patterns and no warnings when all patterns are referenced', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Pattern #1 marks a support level at $42,000
- Pattern #2 shows resistance at $45,000

\`\`\`json
{
  "patterns": [
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 42000},
        {"openTime": 1700080000000, "price": 42000}
      ],
      "label": "Key Support"
    },
    {
      "type": "resistance",
      "points": [
        {"openTime": 1700020000000, "price": 45000},
        {"openTime": 1700080000000, "price": 45000}
      ],
      "label": "Key Resistance"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.patterns).toHaveLength(2);
    expect(result.patterns?.[0]?.id).toBe(1);
    expect(result.patterns?.[1]?.id).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should warn when patterns are not referenced in analysis text', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Pattern #1 marks a support level at $42,000

\`\`\`json
{
  "patterns": [
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 42000},
        {"openTime": 1700080000000, "price": 42000}
      ],
      "label": "Key Support"
    },
    {
      "type": "resistance",
      "points": [
        {"openTime": 1700020000000, "price": 45000},
        {"openTime": 1700080000000, "price": 45000}
      ],
      "label": "Key Resistance"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.patterns).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Patterns not referenced in analysis text: #2')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Total patterns created: 2, Referenced: 1')
    );
  });

  it('should warn when multiple patterns are not referenced', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Pattern #1 marks a support level at $42,000

\`\`\`json
{
  "patterns": [
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 42000},
        {"openTime": 1700080000000, "price": 42000}
      ],
      "label": "Support 1"
    },
    {
      "type": "resistance",
      "points": [
        {"openTime": 1700020000000, "price": 45000},
        {"openTime": 1700080000000, "price": 45000}
      ],
      "label": "Resistance 1"
    },
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 40000},
        {"openTime": 1700080000000, "price": 40000}
      ],
      "label": "Support 2"
    },
    {
      "type": "resistance",
      "points": [
        {"openTime": 1700020000000, "price": 48000},
        {"openTime": 1700080000000, "price": 48000}
      ],
      "label": "Resistance 2"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.patterns).toHaveLength(4);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Patterns not referenced in analysis text: #2, #3, #4')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Total patterns created: 4, Referenced: 1')
    );
  });

  it('should return analysis without patterns when no JSON block present', () => {
    const response = 'Simple analysis without patterns';
    const result = parseAIResponse(response);

    expect(result.analysis).toBe(response);
    expect(result.patterns).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON gracefully', () => {
    const response = `
Analysis text

\`\`\`json
{ invalid json }
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.analysis).toBe(response);
    expect(result.patterns).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('should not warn when no patterns are created', () => {
    const response = `
**Summary**: Simple analysis

\`\`\`json
{
  "patterns": []
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.patterns).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should assign sequential IDs to patterns', () => {
    const response = `
Pattern #1, Pattern #2, Pattern #3

\`\`\`json
{
  "patterns": [
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 42000},
        {"openTime": 1700080000000, "price": 42000}
      ],
      "label": "Support"
    },
    {
      "type": "resistance",
      "points": [
        {"openTime": 1700020000000, "price": 45000},
        {"openTime": 1700080000000, "price": 45000}
      ],
      "label": "Resistance"
    },
    {
      "type": "support",
      "points": [
        {"openTime": 1700020000000, "price": 40000},
        {"openTime": 1700080000000, "price": 40000}
      ],
      "label": "Support 2"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.patterns).toHaveLength(3);
    expect(result.patterns?.[0]?.id).toBe(1);
    expect(result.patterns?.[1]?.id).toBe(2);
    expect(result.patterns?.[2]?.id).toBe(3);
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe('validateAIPattern', () => {
    it('should reject invalid input types', () => {
      expect(validateAIPattern(null)).toBe(false);
      expect(validateAIPattern(undefined)).toBe(false);
      expect(validateAIPattern('string')).toBe(false);
      expect(validateAIPattern(123)).toBe(false);
      expect(validateAIPattern([])).toBe(false);
    });

    it('should reject patterns without type', () => {
      expect(validateAIPattern({ points: [] })).toBe(false);
      expect(validateAIPattern({ type: null })).toBe(false);
      expect(validateAIPattern({ type: 123 })).toBe(false);
    });

    it('should validate support/resistance with points', () => {
      const validPattern: AIPattern = {
        type: 'support',
        points: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700080000000, price: 42000 },
        ],
      };
      expect(validateAIPattern(validPattern)).toBe(true);

      expect(validateAIPattern({ type: 'support', points: [] })).toBe(false);
      expect(validateAIPattern({ type: 'support', points: [{ openTime: 0, price: 100 }] })).toBe(
        false
      );
      expect(validateAIPattern({ type: 'support', points: [{ price: 100 }, { price: 100 }] })).toBe(
        false
      );
      expect(
        validateAIPattern({
          type: 'support',
          points: [{ openTime: 'invalid', price: 100 }, { openTime: 0, price: 100 }],
        })
      ).toBe(false);
    });

    it('should validate trendline with points', () => {
      const validTrendline: AIPattern = {
        type: 'trendline-bullish',
        points: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700080000000, price: 45000 },
        ],
      };
      expect(validateAIPattern(validTrendline)).toBe(true);
    });

    it('should validate zones with topPrice/bottomPrice', () => {
      const validZone: AIPattern = {
        type: 'buy-zone',
        topPrice: 45000,
        bottomPrice: 42000,
        startOpenTime: 1700020000000,
        endOpenTime: 1700080000000,
      };
      expect(validateAIPattern(validZone)).toBe(true);

      expect(
        validateAIPattern({
          type: 'buy-zone',
          topPrice: 42000,
          bottomPrice: 45000,
          startOpenTime: 1700020000000,
          endOpenTime: 1700080000000,
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'buy-zone',
          topPrice: 45000,
          bottomPrice: 42000,
          startOpenTime: 1700080000000,
          endOpenTime: 1700020000000,
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'buy-zone',
          topPrice: '45000',
          bottomPrice: 42000,
          startOpenTime: 1700020000000,
          endOpenTime: 1700080000000,
        })
      ).toBe(false);
    });

    it('should validate channels with upperLine/lowerLine', () => {
      const validChannel: AIPattern = {
        type: 'channel-ascending',
        upperLine: [
          { openTime: 1700020000000, price: 44000 },
          { openTime: 1700080000000, price: 46000 },
        ],
        lowerLine: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700080000000, price: 44000 },
        ],
      };
      expect(validateAIPattern(validChannel)).toBe(true);

      expect(
        validateAIPattern({
          type: 'channel-ascending',
          upperLine: [{ openTime: 0, price: 100 }],
          lowerLine: [
            { openTime: 0, price: 90 },
            { openTime: 1000, price: 90 },
          ],
        })
      ).toBe(false);
    });

    it('should validate fibonacci with startPoint/endPoint/levels', () => {
      const validFib: AIPattern = {
        type: 'fibonacci-retracement',
        startPoint: { openTime: 1700020000000, price: 40000 },
        endPoint: { openTime: 1700080000000, price: 50000 },
        levels: [
          { ratio: 0.236, price: 47640 },
          { ratio: 0.382, price: 46180 },
          { ratio: 0.5, price: 45000 },
          { ratio: 0.618, price: 43820 },
        ],
      };
      expect(validateAIPattern(validFib)).toBe(true);

      expect(
        validateAIPattern({
          type: 'fibonacci-retracement',
          startPoint: { price: 40000 },
          endPoint: { openTime: 1700080000000, price: 50000 },
          levels: [{ ratio: 0.5, price: 45000 }],
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'fibonacci-retracement',
          startPoint: { openTime: 1700020000000, price: 40000 },
          endPoint: { openTime: 1700080000000, price: 50000 },
          levels: [{ ratio: 0.5 }],
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'fibonacci-retracement',
          startPoint: { openTime: 1700020000000, price: 40000 },
          endPoint: { openTime: 1700080000000, price: 50000 },
          levels: 'invalid',
        })
      ).toBe(false);
    });

    it('should validate head and shoulders pattern', () => {
      const validHS: AIPattern = {
        type: 'head-and-shoulders',
        leftShoulder: { openTime: 1700020000000, price: 44000 },
        head: { openTime: 1700040000000, price: 46000 },
        rightShoulder: { openTime: 1700060000000, price: 44000 },
        neckline: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700060000000, price: 42000 },
        ],
      };
      expect(validateAIPattern(validHS)).toBe(true);

      const validHSNoNeckline: AIPattern = {
        type: 'head-and-shoulders',
        leftShoulder: { openTime: 1700020000000, price: 44000 },
        head: { openTime: 1700040000000, price: 46000 },
        rightShoulder: { openTime: 1700060000000, price: 44000 },
      };
      expect(validateAIPattern(validHSNoNeckline)).toBe(true);

      expect(
        validateAIPattern({
          type: 'head-and-shoulders',
          leftShoulder: { price: 44000 },
          head: { openTime: 1700040000000, price: 46000 },
          rightShoulder: { openTime: 1700060000000, price: 44000 },
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'head-and-shoulders',
          leftShoulder: { openTime: 1700020000000, price: 44000 },
          head: { openTime: 1700040000000, price: 46000 },
          rightShoulder: { openTime: 1700060000000, price: 44000 },
          neckline: [{ openTime: 1700020000000, price: 42000 }],
        })
      ).toBe(false);
    });

    it('should validate double top/bottom pattern', () => {
      const validDouble: AIPattern = {
        type: 'double-top',
        firstPeak: { openTime: 1700020000000, price: 45000 },
        secondPeak: { openTime: 1700060000000, price: 45000 },
        neckline: { openTime: 1700040000000, price: 42000 },
      };
      expect(validateAIPattern(validDouble)).toBe(true);

      const validDoubleNoNeckline: AIPattern = {
        type: 'double-top',
        firstPeak: { openTime: 1700020000000, price: 45000 },
        secondPeak: { openTime: 1700060000000, price: 45000 },
      };
      expect(validateAIPattern(validDoubleNoNeckline)).toBe(true);

      expect(
        validateAIPattern({
          type: 'double-top',
          firstPeak: { openTime: 'invalid', price: 45000 },
          secondPeak: { openTime: 1700060000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate triple top/bottom pattern', () => {
      const validTriple: AIPattern = {
        type: 'triple-top',
        peak1: { openTime: 1700020000000, price: 45000 },
        peak2: { openTime: 1700040000000, price: 45000 },
        peak3: { openTime: 1700060000000, price: 45000 },
        neckline: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700060000000, price: 42000 },
        ],
      };
      expect(validateAIPattern(validTriple)).toBe(true);

      const validTripleNoNeckline: AIPattern = {
        type: 'triple-top',
        peak1: { openTime: 1700020000000, price: 45000 },
        peak2: { openTime: 1700040000000, price: 45000 },
        peak3: { openTime: 1700060000000, price: 45000 },
      };
      expect(validateAIPattern(validTripleNoNeckline)).toBe(true);

      expect(
        validateAIPattern({
          type: 'triple-top',
          peak1: { openTime: 1700020000000, price: 45000 },
          peak2: { openTime: 1700040000000 },
          peak3: { openTime: 1700060000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate triangle/wedge with upperTrendline/lowerTrendline', () => {
      const validTriangle: AIPattern = {
        type: 'triangle-ascending',
        upperTrendline: [
          { openTime: 1700020000000, price: 45000 },
          { openTime: 1700080000000, price: 45000 },
        ],
        lowerTrendline: [
          { openTime: 1700020000000, price: 42000 },
          { openTime: 1700080000000, price: 44000 },
        ],
      };
      expect(validateAIPattern(validTriangle)).toBe(true);

      expect(
        validateAIPattern({
          type: 'triangle-ascending',
          upperTrendline: [{ openTime: 1700020000000 }, { openTime: 1700080000000 }],
          lowerTrendline: [
            { openTime: 1700020000000, price: 42000 },
            { openTime: 1700080000000, price: 44000 },
          ],
        })
      ).toBe(false);
    });

    it('should validate flag pattern with flagpole and flag', () => {
      const validFlag: AIPattern = {
        type: 'flag-bullish',
        flagpole: {
          start: { openTime: 1700020000000, price: 40000 },
          end: { openTime: 1700040000000, price: 46000 },
        },
        flag: {
          upperTrendline: [
            { openTime: 1700040000000, price: 46000 },
            { openTime: 1700060000000, price: 45000 },
          ],
          lowerTrendline: [
            { openTime: 1700040000000, price: 44000 },
            { openTime: 1700060000000, price: 43000 },
          ],
        },
      };
      expect(validateAIPattern(validFlag)).toBe(true);

      expect(
        validateAIPattern({
          type: 'flag-bullish',
          flagpole: {
            start: { price: 40000 },
            end: { openTime: 1700040000000, price: 46000 },
          },
          flag: {
            upperTrendline: [
              { openTime: 1700040000000, price: 46000 },
              { openTime: 1700060000000, price: 45000 },
            ],
            lowerTrendline: [
              { openTime: 1700040000000, price: 44000 },
              { openTime: 1700060000000, price: 43000 },
            ],
          },
        })
      ).toBe(false);

      expect(
        validateAIPattern({
          type: 'flag-bullish',
          flagpole: {
            start: { openTime: 1700020000000, price: 40000 },
            end: { openTime: 1700040000000, price: 46000 },
          },
          flag: {
            upperTrendline: [{ openTime: 1700040000000, price: 46000 }],
            lowerTrendline: [
              { openTime: 1700040000000, price: 44000 },
              { openTime: 1700060000000, price: 43000 },
            ],
          },
        })
      ).toBe(false);
    });

    it('should validate pennant pattern with flagpole and pennant', () => {
      const validPennant: AIPattern = {
        type: 'pennant',
        flagpole: {
          start: { openTime: 1700020000000, price: 40000 },
          end: { openTime: 1700040000000, price: 46000 },
        },
        pennant: {
          upperTrendline: [
            { openTime: 1700040000000, price: 46000 },
            { openTime: 1700060000000, price: 45000 },
          ],
          lowerTrendline: [
            { openTime: 1700040000000, price: 44000 },
            { openTime: 1700060000000, price: 44500 },
          ],
        },
      };
      expect(validateAIPattern(validPennant)).toBe(true);

      expect(
        validateAIPattern({
          type: 'pennant',
          flagpole: {
            start: { openTime: 1700020000000, price: 40000 },
            end: { openTime: 1700040000000, price: 46000 },
          },
          pennant: {
            upperTrendline: 'invalid',
            lowerTrendline: [
              { openTime: 1700040000000, price: 44000 },
              { openTime: 1700060000000, price: 44500 },
            ],
          },
        })
      ).toBe(false);
    });

    it('should validate cup and handle pattern', () => {
      const validCup: AIPattern = {
        type: 'cup-and-handle',
        cupStart: { openTime: 1700000000000, price: 45000 },
        cupBottom: { openTime: 1700040000000, price: 40000 },
        cupEnd: { openTime: 1700080000000, price: 45000 },
        handleStart: { openTime: 1700080000000, price: 45000 },
        handleLow: { openTime: 1700090000000, price: 43000 },
        handleEnd: { openTime: 1700100000000, price: 44000 },
      };
      expect(validateAIPattern(validCup)).toBe(true);

      expect(
        validateAIPattern({
          type: 'cup-and-handle',
          cupStart: { price: 45000 },
          cupBottom: { openTime: 1700040000000, price: 40000 },
          cupEnd: { openTime: 1700080000000, price: 45000 },
          handleStart: { openTime: 1700080000000, price: 45000 },
          handleLow: { openTime: 1700090000000, price: 43000 },
          handleEnd: { openTime: 1700100000000, price: 44000 },
        })
      ).toBe(false);
    });

    it('should validate rounding bottom pattern', () => {
      const validRounded: AIPattern = {
        type: 'rounding-bottom',
        start: { openTime: 1700000000000, price: 45000 },
        bottom: { openTime: 1700040000000, price: 40000 },
        end: { openTime: 1700080000000, price: 45000 },
      };
      expect(validateAIPattern(validRounded)).toBe(true);

      expect(
        validateAIPattern({
          type: 'rounding-bottom',
          start: { openTime: 1700000000000 },
          bottom: { openTime: 1700040000000, price: 40000 },
          end: { openTime: 1700080000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate gap patterns', () => {
      const validGap: AIPattern = {
        type: 'gap-breakaway',
        gapStart: { openTime: 1700040000000, price: 43000 },
        gapEnd: { openTime: 1700050000000, price: 45000 },
      };
      expect(validateAIPattern(validGap)).toBe(true);

      expect(
        validateAIPattern({
          type: 'gap-breakaway',
          gapStart: { openTime: 1700040000000, price: 43000 },
          gapEnd: { price: 45000 },
        })
      ).toBe(false);
    });
  });
});
