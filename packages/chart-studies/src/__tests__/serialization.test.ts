import { describe, it, expect } from 'vitest';
import { serializeDrawingData, deserializeDrawingData } from '../serialization';
import type { LineDrawing, PencilDrawing, FibonacciDrawing, TrendLineDrawing, VerticalLineDrawing, HighlighterDrawing, PitchforkDrawing, GannFanDrawing } from '../types';

const baseProps = {
  id: 'test-1',
  symbol: 'BTCUSDT',
  interval: '1h',
  visible: true,
  locked: false,
  zIndex: 0,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('serializeDrawingData', () => {
  it('serializes line drawing', () => {
    const drawing: LineDrawing = {
      ...baseProps, type: 'line',
      startIndex: 5, startPrice: 100, endIndex: 15, endPrice: 200,
    };
    const json = serializeDrawingData(drawing);
    const parsed = JSON.parse(json);
    expect(parsed.startIndex).toBe(5);
    expect(parsed.startPrice).toBe(100);
    expect(parsed.endIndex).toBe(15);
    expect(parsed.endPrice).toBe(200);
  });

  it('serializes pencil drawing', () => {
    const drawing: PencilDrawing = {
      ...baseProps, type: 'pencil',
      points: [{ index: 0, price: 100 }, { index: 5, price: 200 }],
    };
    const json = serializeDrawingData(drawing);
    const parsed = JSON.parse(json);
    expect(parsed.points).toHaveLength(2);
  });

  it('serializes fibonacci drawing', () => {
    const drawing: FibonacciDrawing = {
      ...baseProps, type: 'fibonacci',
      swingLowIndex: 0, swingLowPrice: 100,
      swingHighIndex: 10, swingHighPrice: 200,
      direction: 'up',
      levels: [{ level: 0.618, label: '0.618', price: 161.8 }],
    };
    const json = serializeDrawingData(drawing);
    const parsed = JSON.parse(json);
    expect(parsed.swingLowPrice).toBe(100);
    expect(parsed.levels).toHaveLength(1);
  });
});

describe('deserializeDrawingData', () => {
  it('deserializes line drawing', () => {
    const data = JSON.stringify({ startIndex: 5, startPrice: 100, endIndex: 15, endPrice: 200 });
    const result = deserializeDrawingData('line', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('line');
    if (result!.type === 'line') {
      expect(result!.startIndex).toBe(5);
      expect(result!.endPrice).toBe(200);
    }
  });

  it('deserializes ruler drawing', () => {
    const data = JSON.stringify({ startIndex: 0, startPrice: 50, endIndex: 10, endPrice: 150 });
    const result = deserializeDrawingData('ruler', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ruler');
  });

  it('deserializes rectangle drawing', () => {
    const data = JSON.stringify({ startIndex: 0, startPrice: 50, endIndex: 10, endPrice: 150 });
    const result = deserializeDrawingData('rectangle', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('rectangle');
  });

  it('deserializes area drawing', () => {
    const data = JSON.stringify({ startIndex: 0, startPrice: 50, endIndex: 10, endPrice: 150 });
    const result = deserializeDrawingData('area', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('area');
  });

  it('deserializes pencil drawing', () => {
    const data = JSON.stringify({ points: [{ index: 0, price: 100 }, { index: 5, price: 200 }] });
    const result = deserializeDrawingData('pencil', data, baseProps);
    expect(result).not.toBeNull();
    if (result!.type === 'pencil') {
      expect(result!.points).toHaveLength(2);
    }
  });

  it('deserializes fibonacci drawing', () => {
    const data = JSON.stringify({
      swingLowIndex: 0, swingLowPrice: 100,
      swingHighIndex: 10, swingHighPrice: 200,
      direction: 'up',
      levels: [{ level: 0.618, label: '0.618', price: 161.8 }],
    });
    const result = deserializeDrawingData('fibonacci', data, baseProps);
    expect(result).not.toBeNull();
    if (result!.type === 'fibonacci') {
      expect(result!.direction).toBe('up');
      expect(result!.levels).toHaveLength(1);
    }
  });

  it('returns null for invalid JSON', () => {
    const result = deserializeDrawingData('line', 'invalid', baseProps);
    expect(result).toBeNull();
  });

  it('roundtrips correctly', () => {
    const original: FibonacciDrawing = {
      ...baseProps, type: 'fibonacci',
      swingLowIndex: 0, swingLowPrice: 100,
      swingHighIndex: 10, swingHighPrice: 200,
      direction: 'up',
      levels: [{ level: 0.618, label: '0.618', price: 161.8 }],
    };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('fibonacci', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });

  it('deserializes trendLine drawing', () => {
    const data = JSON.stringify({ startIndex: 3, startPrice: 100, endIndex: 20, endPrice: 300 });
    const result = deserializeDrawingData('trendLine', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('trendLine');
  });

  it('deserializes priceRange drawing', () => {
    const data = JSON.stringify({ startIndex: 5, startPrice: 100, endIndex: 15, endPrice: 120 });
    const result = deserializeDrawingData('priceRange', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('priceRange');
  });

  it('deserializes ellipse drawing', () => {
    const data = JSON.stringify({ startIndex: 2, startPrice: 200, endIndex: 12, endPrice: 300 });
    const result = deserializeDrawingData('ellipse', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ellipse');
  });

  it('deserializes gannFan drawing', () => {
    const data = JSON.stringify({ startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 200 });
    const result = deserializeDrawingData('gannFan', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('gannFan');
  });

  it('deserializes verticalLine drawing', () => {
    const data = JSON.stringify({ index: 10, price: 500 });
    const result = deserializeDrawingData('verticalLine', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('verticalLine');
    if (result!.type === 'verticalLine') {
      expect(result!.index).toBe(10);
      expect(result!.price).toBe(500);
    }
  });

  it('deserializes anchoredVwap drawing', () => {
    const data = JSON.stringify({ index: 5, price: 300 });
    const result = deserializeDrawingData('anchoredVwap', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('anchoredVwap');
  });

  it('deserializes highlighter drawing', () => {
    const data = JSON.stringify({ points: [{ index: 0, price: 100 }, { index: 3, price: 150 }] });
    const result = deserializeDrawingData('highlighter', data, baseProps);
    expect(result).not.toBeNull();
    if (result!.type === 'highlighter') {
      expect(result!.points).toHaveLength(2);
    }
  });

  it('deserializes pitchfork drawing', () => {
    const data = JSON.stringify({ startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 200, widthIndex: 5, widthPrice: 150 });
    const result = deserializeDrawingData('pitchfork', data, baseProps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('pitchfork');
    if (result!.type === 'pitchfork') {
      expect(result!.widthIndex).toBe(5);
      expect(result!.widthPrice).toBe(150);
    }
  });

  it('roundtrips trendLine correctly', () => {
    const original: TrendLineDrawing = { ...baseProps, type: 'trendLine', startIndex: 3, startPrice: 100, endIndex: 20, endPrice: 300 };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('trendLine', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });

  it('roundtrips verticalLine correctly', () => {
    const original: VerticalLineDrawing = { ...baseProps, type: 'verticalLine', index: 10, price: 500 };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('verticalLine', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });

  it('roundtrips highlighter correctly', () => {
    const original: HighlighterDrawing = { ...baseProps, type: 'highlighter', points: [{ index: 0, price: 100 }, { index: 5, price: 200 }] };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('highlighter', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });

  it('roundtrips pitchfork correctly', () => {
    const original: PitchforkDrawing = { ...baseProps, type: 'pitchfork', startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 200, widthIndex: 5, widthPrice: 150 };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('pitchfork', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });

  it('roundtrips gannFan correctly', () => {
    const original: GannFanDrawing = { ...baseProps, type: 'gannFan', startIndex: 0, startPrice: 100, endIndex: 10, endPrice: 200 };
    const serialized = serializeDrawingData(original);
    const deserialized = deserializeDrawingData('gannFan', serialized, baseProps);
    expect(deserialized).toEqual(original);
  });
});
