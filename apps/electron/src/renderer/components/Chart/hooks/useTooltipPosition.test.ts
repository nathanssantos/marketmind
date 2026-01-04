import { describe, expect, it } from 'vitest';
import { calculateTooltipPosition } from './useTooltipPosition';

describe('calculateTooltipPosition', () => {
  const defaultOptions = {
    x: 100,
    y: 100,
    tooltipWidth: 200,
    tooltipHeight: 150,
    containerWidth: 800,
    containerHeight: 600,
    offset: 10,
  };

  it('should position tooltip to the right and below cursor by default', () => {
    const result = calculateTooltipPosition(defaultOptions);

    expect(result.left).toBe(110);
    expect(result.top).toBe(110);
  });

  it('should flip tooltip to the left when it would overflow right edge', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      x: 700,
    });

    expect(result.left).toBe(490);
  });

  it('should flip tooltip above when it would overflow bottom edge', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      y: 500,
    });

    expect(result.top).toBe(340);
  });

  it('should clamp left position to offset when negative', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      x: 50,
      containerWidth: 100,
    });

    expect(result.left).toBe(10);
  });

  it('should clamp top position to offset when negative', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      y: 50,
      containerHeight: 100,
    });

    expect(result.top).toBe(10);
  });

  it('should handle cursor at top-left corner', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      x: 0,
      y: 0,
    });

    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });

  it('should handle cursor at bottom-right corner', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      x: 800,
      y: 600,
    });

    expect(result.left).toBe(590);
    expect(result.top).toBe(440);
  });

  it('should use default offset of 10', () => {
    const result = calculateTooltipPosition({
      x: 100,
      y: 100,
      tooltipWidth: 200,
      tooltipHeight: 150,
      containerWidth: 800,
      containerHeight: 600,
    });

    expect(result.left).toBe(110);
    expect(result.top).toBe(110);
  });

  it('should use custom offset', () => {
    const result = calculateTooltipPosition({
      ...defaultOptions,
      offset: 20,
    });

    expect(result.left).toBe(120);
    expect(result.top).toBe(120);
  });

  it('should handle very small container', () => {
    const result = calculateTooltipPosition({
      x: 50,
      y: 50,
      tooltipWidth: 200,
      tooltipHeight: 150,
      containerWidth: 100,
      containerHeight: 100,
      offset: 10,
    });

    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });

  it('should handle tooltip larger than container', () => {
    const result = calculateTooltipPosition({
      x: 50,
      y: 50,
      tooltipWidth: 500,
      tooltipHeight: 400,
      containerWidth: 300,
      containerHeight: 200,
      offset: 10,
    });

    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });
});
