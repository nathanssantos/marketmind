import type { AIStudy } from '@shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAIResponse, validateAIStudy } from './AIResponseParser';

describe('AIResponseParser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse response with studies and no warnings when all studies are referenced', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Study #1 marks a support level at $42,000
- Study #2 shows resistance at $45,000

\`\`\`json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 42000},
        {"timestamp": 1700080000000, "price": 42000}
      ],
      "label": "Key Support"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1700020000000, "price": 45000},
        {"timestamp": 1700080000000, "price": 45000}
      ],
      "label": "Key Resistance"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.studies).toHaveLength(2);
    expect(result.studies?.[0]?.id).toBe(1);
    expect(result.studies?.[1]?.id).toBe(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should warn when studies are not referenced in analysis text', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Study #1 marks a support level at $42,000

\`\`\`json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 42000},
        {"timestamp": 1700080000000, "price": 42000}
      ],
      "label": "Key Support"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1700020000000, "price": 45000},
        {"timestamp": 1700080000000, "price": 45000}
      ],
      "label": "Key Resistance"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.studies).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Studies not referenced in analysis text: #2')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Total studies created: 2, Referenced: 1')
    );
  });

  it('should warn when multiple studies are not referenced', () => {
    const response = `
**Summary**: The market shows strong support.

**Key Observations**:
- Study #1 marks a support level at $42,000

\`\`\`json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 42000},
        {"timestamp": 1700080000000, "price": 42000}
      ],
      "label": "Support 1"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1700020000000, "price": 45000},
        {"timestamp": 1700080000000, "price": 45000}
      ],
      "label": "Resistance 1"
    },
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 40000},
        {"timestamp": 1700080000000, "price": 40000}
      ],
      "label": "Support 2"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1700020000000, "price": 48000},
        {"timestamp": 1700080000000, "price": 48000}
      ],
      "label": "Resistance 2"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.studies).toHaveLength(4);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Studies not referenced in analysis text: #2, #3, #4')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Total studies created: 4, Referenced: 1')
    );
  });

  it('should return analysis without studies when no JSON block present', () => {
    const response = 'Simple analysis without studies';
    const result = parseAIResponse(response);

    expect(result.analysis).toBe(response);
    expect(result.studies).toBeUndefined();
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
    expect(result.studies).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('should not warn when no studies are created', () => {
    const response = `
**Summary**: Simple analysis

\`\`\`json
{
  "studies": []
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.studies).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should assign sequential IDs to studies', () => {
    const response = `
Study #1, Study #2, Study #3

\`\`\`json
{
  "studies": [
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 42000},
        {"timestamp": 1700080000000, "price": 42000}
      ],
      "label": "Support"
    },
    {
      "type": "resistance",
      "points": [
        {"timestamp": 1700020000000, "price": 45000},
        {"timestamp": 1700080000000, "price": 45000}
      ],
      "label": "Resistance"
    },
    {
      "type": "support",
      "points": [
        {"timestamp": 1700020000000, "price": 40000},
        {"timestamp": 1700080000000, "price": 40000}
      ],
      "label": "Support 2"
    }
  ]
}
\`\`\`
    `.trim();

    const result = parseAIResponse(response);

    expect(result.studies).toHaveLength(3);
    expect(result.studies?.[0]?.id).toBe(1);
    expect(result.studies?.[1]?.id).toBe(2);
    expect(result.studies?.[2]?.id).toBe(3);
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe('validateAIStudy', () => {
    it('should reject invalid input types', () => {
      expect(validateAIStudy(null)).toBe(false);
      expect(validateAIStudy(undefined)).toBe(false);
      expect(validateAIStudy('string')).toBe(false);
      expect(validateAIStudy(123)).toBe(false);
      expect(validateAIStudy([])).toBe(false);
    });

    it('should reject studies without type', () => {
      expect(validateAIStudy({ points: [] })).toBe(false);
      expect(validateAIStudy({ type: null })).toBe(false);
      expect(validateAIStudy({ type: 123 })).toBe(false);
    });

    it('should validate support/resistance with points', () => {
      const validStudy: AIStudy = {
        type: 'support',
        points: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700080000000, price: 42000 },
        ],
      };
      expect(validateAIStudy(validStudy)).toBe(true);

      expect(validateAIStudy({ type: 'support', points: [] })).toBe(false);
      expect(validateAIStudy({ type: 'support', points: [{ timestamp: 0, price: 100 }] })).toBe(
        false
      );
      expect(validateAIStudy({ type: 'support', points: [{ price: 100 }, { price: 100 }] })).toBe(
        false
      );
      expect(
        validateAIStudy({
          type: 'support',
          points: [{ timestamp: 'invalid', price: 100 }, { timestamp: 0, price: 100 }],
        })
      ).toBe(false);
    });

    it('should validate trendline with points', () => {
      const validTrendline: AIStudy = {
        type: 'trendline-bullish',
        points: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700080000000, price: 45000 },
        ],
      };
      expect(validateAIStudy(validTrendline)).toBe(true);
    });

    it('should validate zones with topPrice/bottomPrice', () => {
      const validZone: AIStudy = {
        type: 'buy-zone',
        topPrice: 45000,
        bottomPrice: 42000,
        startTimestamp: 1700020000000,
        endTimestamp: 1700080000000,
      };
      expect(validateAIStudy(validZone)).toBe(true);

      expect(
        validateAIStudy({
          type: 'buy-zone',
          topPrice: 42000,
          bottomPrice: 45000,
          startTimestamp: 1700020000000,
          endTimestamp: 1700080000000,
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'buy-zone',
          topPrice: 45000,
          bottomPrice: 42000,
          startTimestamp: 1700080000000,
          endTimestamp: 1700020000000,
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'buy-zone',
          topPrice: '45000',
          bottomPrice: 42000,
          startTimestamp: 1700020000000,
          endTimestamp: 1700080000000,
        })
      ).toBe(false);
    });

    it('should validate channels with upperLine/lowerLine', () => {
      const validChannel: AIStudy = {
        type: 'channel-ascending',
        upperLine: [
          { timestamp: 1700020000000, price: 44000 },
          { timestamp: 1700080000000, price: 46000 },
        ],
        lowerLine: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700080000000, price: 44000 },
        ],
      };
      expect(validateAIStudy(validChannel)).toBe(true);

      expect(
        validateAIStudy({
          type: 'channel-ascending',
          upperLine: [{ timestamp: 0, price: 100 }],
          lowerLine: [
            { timestamp: 0, price: 90 },
            { timestamp: 1000, price: 90 },
          ],
        })
      ).toBe(false);
    });

    it('should validate fibonacci with startPoint/endPoint/levels', () => {
      const validFib: AIStudy = {
        type: 'fibonacci-retracement',
        startPoint: { timestamp: 1700020000000, price: 40000 },
        endPoint: { timestamp: 1700080000000, price: 50000 },
        levels: [
          { ratio: 0.236, price: 47640 },
          { ratio: 0.382, price: 46180 },
          { ratio: 0.5, price: 45000 },
          { ratio: 0.618, price: 43820 },
        ],
      };
      expect(validateAIStudy(validFib)).toBe(true);

      expect(
        validateAIStudy({
          type: 'fibonacci-retracement',
          startPoint: { price: 40000 },
          endPoint: { timestamp: 1700080000000, price: 50000 },
          levels: [{ ratio: 0.5, price: 45000 }],
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'fibonacci-retracement',
          startPoint: { timestamp: 1700020000000, price: 40000 },
          endPoint: { timestamp: 1700080000000, price: 50000 },
          levels: [{ ratio: 0.5 }],
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'fibonacci-retracement',
          startPoint: { timestamp: 1700020000000, price: 40000 },
          endPoint: { timestamp: 1700080000000, price: 50000 },
          levels: 'invalid',
        })
      ).toBe(false);
    });

    it('should validate head and shoulders pattern', () => {
      const validHS: AIStudy = {
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1700020000000, price: 44000 },
        head: { timestamp: 1700040000000, price: 46000 },
        rightShoulder: { timestamp: 1700060000000, price: 44000 },
        neckline: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700060000000, price: 42000 },
        ],
      };
      expect(validateAIStudy(validHS)).toBe(true);

      const validHSNoNeckline: AIStudy = {
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1700020000000, price: 44000 },
        head: { timestamp: 1700040000000, price: 46000 },
        rightShoulder: { timestamp: 1700060000000, price: 44000 },
      };
      expect(validateAIStudy(validHSNoNeckline)).toBe(true);

      expect(
        validateAIStudy({
          type: 'head-and-shoulders',
          leftShoulder: { price: 44000 },
          head: { timestamp: 1700040000000, price: 46000 },
          rightShoulder: { timestamp: 1700060000000, price: 44000 },
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'head-and-shoulders',
          leftShoulder: { timestamp: 1700020000000, price: 44000 },
          head: { timestamp: 1700040000000, price: 46000 },
          rightShoulder: { timestamp: 1700060000000, price: 44000 },
          neckline: [{ timestamp: 1700020000000, price: 42000 }],
        })
      ).toBe(false);
    });

    it('should validate double top/bottom pattern', () => {
      const validDouble: AIStudy = {
        type: 'double-top',
        firstPeak: { timestamp: 1700020000000, price: 45000 },
        secondPeak: { timestamp: 1700060000000, price: 45000 },
        neckline: { timestamp: 1700040000000, price: 42000 },
      };
      expect(validateAIStudy(validDouble)).toBe(true);

      const validDoubleNoNeckline: AIStudy = {
        type: 'double-top',
        firstPeak: { timestamp: 1700020000000, price: 45000 },
        secondPeak: { timestamp: 1700060000000, price: 45000 },
      };
      expect(validateAIStudy(validDoubleNoNeckline)).toBe(true);

      expect(
        validateAIStudy({
          type: 'double-top',
          firstPeak: { timestamp: 'invalid', price: 45000 },
          secondPeak: { timestamp: 1700060000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate triple top/bottom pattern', () => {
      const validTriple: AIStudy = {
        type: 'triple-top',
        peak1: { timestamp: 1700020000000, price: 45000 },
        peak2: { timestamp: 1700040000000, price: 45000 },
        peak3: { timestamp: 1700060000000, price: 45000 },
        neckline: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700060000000, price: 42000 },
        ],
      };
      expect(validateAIStudy(validTriple)).toBe(true);

      const validTripleNoNeckline: AIStudy = {
        type: 'triple-top',
        peak1: { timestamp: 1700020000000, price: 45000 },
        peak2: { timestamp: 1700040000000, price: 45000 },
        peak3: { timestamp: 1700060000000, price: 45000 },
      };
      expect(validateAIStudy(validTripleNoNeckline)).toBe(true);

      expect(
        validateAIStudy({
          type: 'triple-top',
          peak1: { timestamp: 1700020000000, price: 45000 },
          peak2: { timestamp: 1700040000000 },
          peak3: { timestamp: 1700060000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate triangle/wedge with upperTrendline/lowerTrendline', () => {
      const validTriangle: AIStudy = {
        type: 'triangle-ascending',
        upperTrendline: [
          { timestamp: 1700020000000, price: 45000 },
          { timestamp: 1700080000000, price: 45000 },
        ],
        lowerTrendline: [
          { timestamp: 1700020000000, price: 42000 },
          { timestamp: 1700080000000, price: 44000 },
        ],
      };
      expect(validateAIStudy(validTriangle)).toBe(true);

      expect(
        validateAIStudy({
          type: 'triangle-ascending',
          upperTrendline: [{ timestamp: 1700020000000 }, { timestamp: 1700080000000 }],
          lowerTrendline: [
            { timestamp: 1700020000000, price: 42000 },
            { timestamp: 1700080000000, price: 44000 },
          ],
        })
      ).toBe(false);
    });

    it('should validate flag pattern with flagpole and flag', () => {
      const validFlag: AIStudy = {
        type: 'flag-bullish',
        flagpole: {
          start: { timestamp: 1700020000000, price: 40000 },
          end: { timestamp: 1700040000000, price: 46000 },
        },
        flag: {
          upperTrendline: [
            { timestamp: 1700040000000, price: 46000 },
            { timestamp: 1700060000000, price: 45000 },
          ],
          lowerTrendline: [
            { timestamp: 1700040000000, price: 44000 },
            { timestamp: 1700060000000, price: 43000 },
          ],
        },
      };
      expect(validateAIStudy(validFlag)).toBe(true);

      expect(
        validateAIStudy({
          type: 'flag-bullish',
          flagpole: {
            start: { price: 40000 },
            end: { timestamp: 1700040000000, price: 46000 },
          },
          flag: {
            upperTrendline: [
              { timestamp: 1700040000000, price: 46000 },
              { timestamp: 1700060000000, price: 45000 },
            ],
            lowerTrendline: [
              { timestamp: 1700040000000, price: 44000 },
              { timestamp: 1700060000000, price: 43000 },
            ],
          },
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'flag-bullish',
          flagpole: {
            start: { timestamp: 1700020000000, price: 40000 },
            end: { timestamp: 1700040000000, price: 46000 },
          },
          flag: {
            upperTrendline: [{ timestamp: 1700040000000, price: 46000 }],
            lowerTrendline: [
              { timestamp: 1700040000000, price: 44000 },
              { timestamp: 1700060000000, price: 43000 },
            ],
          },
        })
      ).toBe(false);
    });

    it('should validate pennant pattern with flagpole and pennant', () => {
      const validPennant: AIStudy = {
        type: 'pennant',
        flagpole: {
          start: { timestamp: 1700020000000, price: 40000 },
          end: { timestamp: 1700040000000, price: 46000 },
        },
        pennant: {
          upperTrendline: [
            { timestamp: 1700040000000, price: 46000 },
            { timestamp: 1700060000000, price: 45000 },
          ],
          lowerTrendline: [
            { timestamp: 1700040000000, price: 44000 },
            { timestamp: 1700060000000, price: 44500 },
          ],
        },
      };
      expect(validateAIStudy(validPennant)).toBe(true);

      expect(
        validateAIStudy({
          type: 'pennant',
          flagpole: {
            start: { timestamp: 1700020000000, price: 40000 },
            end: { timestamp: 1700040000000, price: 46000 },
          },
          pennant: {
            upperTrendline: 'invalid',
            lowerTrendline: [
              { timestamp: 1700040000000, price: 44000 },
              { timestamp: 1700060000000, price: 44500 },
            ],
          },
        })
      ).toBe(false);
    });

    it('should validate cup and handle pattern', () => {
      const validCup: AIStudy = {
        type: 'cup-and-handle',
        cupStart: { timestamp: 1700000000000, price: 45000 },
        cupBottom: { timestamp: 1700040000000, price: 40000 },
        cupEnd: { timestamp: 1700080000000, price: 45000 },
        handleStart: { timestamp: 1700080000000, price: 45000 },
        handleLow: { timestamp: 1700090000000, price: 43000 },
        handleEnd: { timestamp: 1700100000000, price: 44000 },
      };
      expect(validateAIStudy(validCup)).toBe(true);

      expect(
        validateAIStudy({
          type: 'cup-and-handle',
          cupStart: { price: 45000 },
          cupBottom: { timestamp: 1700040000000, price: 40000 },
          cupEnd: { timestamp: 1700080000000, price: 45000 },
          handleStart: { timestamp: 1700080000000, price: 45000 },
          handleLow: { timestamp: 1700090000000, price: 43000 },
          handleEnd: { timestamp: 1700100000000, price: 44000 },
        })
      ).toBe(false);
    });

    it('should validate rounding bottom pattern', () => {
      const validRounded: AIStudy = {
        type: 'rounding-bottom',
        start: { timestamp: 1700000000000, price: 45000 },
        bottom: { timestamp: 1700040000000, price: 40000 },
        end: { timestamp: 1700080000000, price: 45000 },
      };
      expect(validateAIStudy(validRounded)).toBe(true);

      expect(
        validateAIStudy({
          type: 'rounding-bottom',
          start: { timestamp: 1700000000000 },
          bottom: { timestamp: 1700040000000, price: 40000 },
          end: { timestamp: 1700080000000, price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate gap patterns', () => {
      const validGap: AIStudy = {
        type: 'gap-breakaway',
        gapStart: { timestamp: 1700040000000, price: 43000 },
        gapEnd: { timestamp: 1700050000000, price: 45000 },
      };
      expect(validateAIStudy(validGap)).toBe(true);

      expect(
        validateAIStudy({
          type: 'gap-breakaway',
          gapStart: { timestamp: 1700040000000, price: 43000 },
          gapEnd: { price: 45000 },
        })
      ).toBe(false);
    });

    it('should validate elliott wave pattern', () => {
      const validElliott: AIStudy = {
        type: 'elliott-wave',
        impulse: {
          wave1: {
            start: { timestamp: 1700000000000, price: 40000 },
            end: { timestamp: 1700010000000, price: 42000 },
          },
          wave2: {
            start: { timestamp: 1700010000000, price: 42000 },
            end: { timestamp: 1700020000000, price: 41000 },
          },
          wave3: {
            start: { timestamp: 1700020000000, price: 41000 },
            end: { timestamp: 1700040000000, price: 45000 },
          },
          wave4: {
            start: { timestamp: 1700040000000, price: 45000 },
            end: { timestamp: 1700050000000, price: 43000 },
          },
          wave5: {
            start: { timestamp: 1700050000000, price: 43000 },
            end: { timestamp: 1700060000000, price: 46000 },
          },
        },
      };
      expect(validateAIStudy(validElliott)).toBe(true);

      expect(
        validateAIStudy({
          type: 'elliott-wave',
          impulse: {
            wave1: {
              start: { price: 40000 },
              end: { timestamp: 1700010000000, price: 42000 },
            },
            wave2: {
              start: { timestamp: 1700010000000, price: 42000 },
              end: { timestamp: 1700020000000, price: 41000 },
            },
            wave3: {
              start: { timestamp: 1700020000000, price: 41000 },
              end: { timestamp: 1700040000000, price: 45000 },
            },
            wave4: {
              start: { timestamp: 1700040000000, price: 45000 },
              end: { timestamp: 1700050000000, price: 43000 },
            },
            wave5: {
              start: { timestamp: 1700050000000, price: 43000 },
              end: { timestamp: 1700060000000, price: 46000 },
            },
          },
        })
      ).toBe(false);

      expect(
        validateAIStudy({
          type: 'elliott-wave',
          impulse: {
            wave1: {
              start: { timestamp: 1700000000000, price: 40000 },
              end: { timestamp: 1700010000000, price: 42000 },
            },
            wave2: {
              start: { timestamp: 1700010000000, price: 42000 },
              end: { timestamp: 1700020000000, price: 41000 },
            },
            wave3: {
              start: { timestamp: 1700020000000, price: 41000 },
              end: { timestamp: 1700040000000, price: 45000 },
            },
            wave4: {
              start: { timestamp: 1700040000000, price: 45000 },
              end: { timestamp: 1700050000000, price: 43000 },
            },
          },
        })
      ).toBe(false);
    });
  });
});
