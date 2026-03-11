import { describe, it, expect } from 'vitest';
import { serializeDrawingData, deserializeDrawingData } from '../serialization';
import type { LineDrawing, PencilDrawing, FibonacciDrawing } from '../types';

const baseProps = {
  id: 'test-1',
  symbol: 'BTCUSDT',
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
});
