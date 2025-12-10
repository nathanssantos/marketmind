import { describe, expect, it } from 'vitest';
import {
    isPointInPolygon,
    isPointInRect,
    isPointNearLine,
    isPointNearPolygonEdge,
    type HitTestPoint,
} from './hitTesting';

describe('Hit Testing Utils', () => {
  describe('isPointNearLine', () => {
    it('should detect point on horizontal line', () => {
      const point: HitTestPoint = { x: 50, y: 100 };
      const lineStart: HitTestPoint = { x: 0, y: 100 };
      const lineEnd: HitTestPoint = { x: 100, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(true);
    });

    it('should detect point on vertical line', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const lineStart: HitTestPoint = { x: 50, y: 0 };
      const lineEnd: HitTestPoint = { x: 50, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(true);
    });

    it('should detect point on diagonal line', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const lineStart: HitTestPoint = { x: 0, y: 0 };
      const lineEnd: HitTestPoint = { x: 100, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(true);
    });

    it('should reject point far from line', () => {
      const point: HitTestPoint = { x: 50, y: 150 };
      const lineStart: HitTestPoint = { x: 0, y: 100 };
      const lineEnd: HitTestPoint = { x: 100, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(false);
    });

    it('should reject point beyond line segment', () => {
      const point: HitTestPoint = { x: 150, y: 100 };
      const lineStart: HitTestPoint = { x: 0, y: 100 };
      const lineEnd: HitTestPoint = { x: 100, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(false);
    });

    it('should handle zero-length line', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const lineStart: HitTestPoint = { x: 100, y: 100 };
      const lineEnd: HitTestPoint = { x: 100, y: 100 };
      
      expect(isPointNearLine(point, lineStart, lineEnd, 5)).toBe(false);
    });
  });

  describe('isPointInRect', () => {
    it('should detect point inside rectangle', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      
      expect(isPointInRect(point, rect)).toBe(true);
    });

    it('should detect point on rectangle edge', () => {
      const point: HitTestPoint = { x: 100, y: 50 };
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      
      expect(isPointInRect(point, rect)).toBe(true);
    });

    it('should reject point outside rectangle', () => {
      const point: HitTestPoint = { x: 150, y: 50 };
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      
      expect(isPointInRect(point, rect)).toBe(false);
    });
  });

  describe('isPointInPolygon', () => {
    it('should detect point inside triangle', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const triangle: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      
      expect(isPointInPolygon(point, triangle)).toBe(true);
    });

    it('should reject point outside triangle', () => {
      const point: HitTestPoint = { x: 150, y: 50 };
      const triangle: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      
      expect(isPointInPolygon(point, triangle)).toBe(false);
    });

    it('should detect point inside complex polygon', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const polygon: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];
      
      expect(isPointInPolygon(point, polygon)).toBe(true);
    });

    it('should handle polygon with less than 3 vertices', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const line: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ];
      
      expect(isPointInPolygon(point, line)).toBe(false);
    });
  });

  describe('isPointNearPolygonEdge', () => {
    it('should detect point near triangle edge', () => {
      const point: HitTestPoint = { x: 50, y: 2 };
      const triangle: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      
      expect(isPointNearPolygonEdge(point, triangle, 5)).toBe(true);
    });

    it('should reject point far from all edges', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const triangle: HitTestPoint[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];
      
      expect(isPointNearPolygonEdge(point, triangle, 5)).toBe(false);
    });

    it('should handle polygon with less than 2 vertices', () => {
      const point: HitTestPoint = { x: 50, y: 50 };
      const singlePoint: HitTestPoint[] = [{ x: 0, y: 0 }];
      
      expect(isPointNearPolygonEdge(point, singlePoint, 5)).toBe(false);
    });
  });
});
