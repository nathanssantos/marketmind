import { describe, expect, it } from 'vitest';
import { createDynamicValueToY, createNormalizedValueToY } from './oscillatorRendering';

describe('createNormalizedValueToY', () => {
  const panelTop = 100;
  const panelHeight = 200;
  const padding = 10;

  it('maps 0 to bottom and 100 to top when not flipped', () => {
    const valueToY = createNormalizedValueToY(panelTop, panelHeight, padding);
    expect(valueToY(0)).toBe(panelTop + padding + (panelHeight - padding * 2));
    expect(valueToY(100)).toBe(panelTop + padding);
  });

  it('inverts: maps 0 to top and 100 to bottom when flipped', () => {
    const valueToY = createNormalizedValueToY(panelTop, panelHeight, padding, true);
    expect(valueToY(0)).toBe(panelTop + padding);
    expect(valueToY(100)).toBe(panelTop + padding + (panelHeight - padding * 2));
  });

  it('mirror: flipped(v) + notFlipped(v) === panelTop * 2 + panelHeight (constant)', () => {
    const a = createNormalizedValueToY(panelTop, panelHeight, padding, false);
    const b = createNormalizedValueToY(panelTop, panelHeight, padding, true);
    expect(a(50) + b(50)).toBeCloseTo(a(0) + a(100));
    expect(a(25) + b(25)).toBeCloseTo(a(0) + a(100));
  });
});

describe('createDynamicValueToY', () => {
  const panelTop = 50;
  const panelHeight = 100;
  const padding = 0;

  it('maps min to bottom and max to top when not flipped', () => {
    const valueToY = createDynamicValueToY(panelTop, panelHeight, padding, -10, 10);
    expect(valueToY(-10)).toBe(panelTop + panelHeight);
    expect(valueToY(10)).toBe(panelTop);
  });

  it('inverts: maps min to top and max to bottom when flipped', () => {
    const valueToY = createDynamicValueToY(panelTop, panelHeight, padding, -10, 10, true);
    expect(valueToY(-10)).toBe(panelTop);
    expect(valueToY(10)).toBe(panelTop + panelHeight);
  });

  it('zero stays at the middle when range is symmetric, in both orientations', () => {
    const a = createDynamicValueToY(panelTop, panelHeight, padding, -10, 10, false);
    const b = createDynamicValueToY(panelTop, panelHeight, padding, -10, 10, true);
    expect(a(0)).toBe(panelTop + panelHeight / 2);
    expect(b(0)).toBe(panelTop + panelHeight / 2);
  });
});
