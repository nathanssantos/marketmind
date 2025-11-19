import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAIResponse } from './AIResponseParser';

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
});
