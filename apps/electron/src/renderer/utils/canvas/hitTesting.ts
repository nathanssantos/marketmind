import { CHART_CONFIG } from '@shared/constants';
import type { AIPattern, Kline } from '@marketmind/types';
import type { CanvasManager } from './CanvasManager';

export interface HitTestPoint {
  x: number;
  y: number;
}

const LINE_HIT_THRESHOLD = 6;
const TAG_HIT_PADDING = 4;
const TAG_PADDING_MULTIPLIER = 2;
const POWER_TWO = 2;
const MIN_POLYGON_VERTICES = 3;
const MIN_LINE_POINTS = 2;
const UPPER_LINE_COUNT = 2;
const TRIANGLE_VERTEX_COUNT = 4;
const ZERO = 0;
const ONE = 1;

export const isPointNearLine = (
  point: HitTestPoint,
  lineStart: HitTestPoint,
  lineEnd: HitTestPoint,
  threshold: number = LINE_HIT_THRESHOLD
): boolean => {
  const x0 = point.x;
  const y0 = point.y;
  const x1 = lineStart.x;
  const y1 = lineStart.y;
  const x2 = lineEnd.x;
  const y2 = lineEnd.y;

  const lineLength = Math.sqrt((x2 - x1) ** POWER_TWO + (y2 - y1) ** POWER_TWO);
  if (lineLength === ZERO) return false;

  const t = Math.max(ZERO, Math.min(ONE, ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / (lineLength ** POWER_TWO)));
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  
  const distance = Math.sqrt((x0 - projX) ** POWER_TWO + (y0 - projY) ** POWER_TWO);
  
  return distance <= threshold;
};

export const isPointInPolygon = (point: HitTestPoint, vertices: HitTestPoint[]): boolean => {
  if (vertices.length < MIN_POLYGON_VERTICES) return false;

  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = ZERO, j = vertices.length - ONE; i < vertices.length; j = i++) {
    const vertex = vertices[i];
    const prevVertex = vertices[j];
    if (!vertex || !prevVertex) continue;
    
    const xi = vertex.x;
    const yi = vertex.y;
    const xj = prevVertex.x;
    const yj = prevVertex.y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
};

export const isPointNearPolygonEdge = (
  point: HitTestPoint,
  vertices: HitTestPoint[],
  threshold: number = LINE_HIT_THRESHOLD
): boolean => {
  if (vertices.length < MIN_LINE_POINTS) return false;

  for (let i = ZERO; i < vertices.length; i++) {
    const start = vertices[i];
    const end = vertices[(i + ONE) % vertices.length];
    
    if (!start || !end) continue;
    
    if (isPointNearLine(point, start, end, threshold)) {
      return true;
    }
  }

  return false;
};

export const isPointInRect = (
  point: HitTestPoint,
  rect: { x: number; y: number; width: number; height: number }
): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

export const testLinePatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
): boolean => {
  if (!('points' in pattern)) return false;

  const [point1, point2] = pattern.points;
  const index1 = klines.findIndex(c => c.openTime >= point1.openTime);
  const index2 = klines.findIndex(c => c.openTime >= point2.openTime);

  if (index1 === -1 || index2 === -1) return false;

  const x1 = canvasManager.indexToCenterX(index1);
  const x2 = canvasManager.indexToCenterX(index2);
  const y1 = canvasManager.priceToY(point1.price);
  const y2 = canvasManager.priceToY(point2.price);

  let finalX2 = x2;
  let finalY2 = y2;

  if (pattern.type === 'support' || pattern.type === 'resistance') {
    const lastKlineX = canvasManager.indexToX(klines.length - 1);
    const extensionDistance = CHART_CONFIG.PATTERN_EXTENSION_DISTANCE;
    const targetX = lastKlineX + extensionDistance;

    if (x2 < targetX) {
      finalX2 = targetX;
      const slope = (y2 - y1) / (x2 - x1);
      finalY2 = y1 + slope * (finalX2 - x1);
    }
  }

  return isPointNearLine(
    mousePoint,
    { x: x1, y: y1 },
    { x: finalX2, y: finalY2 }
  );
};

export const testZonePatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
): boolean => {
  if (!('topPrice' in pattern)) return false;

  const startIndex = klines.findIndex(c => c.openTime >= pattern.startOpenTime);
  const endIndex = klines.findIndex(c => c.openTime >= pattern.endOpenTime);

  if (startIndex === -1 || endIndex === -1) return false;

  const x1 = canvasManager.indexToCenterX(startIndex);
  let x2 = canvasManager.indexToCenterX(endIndex);
  const y1 = canvasManager.priceToY(pattern.topPrice);
  const y2 = canvasManager.priceToY(pattern.bottomPrice);

  if (pattern.type === 'buy-zone' || pattern.type === 'sell-zone' || 
      pattern.type === 'liquidity-zone' || pattern.type === 'accumulation-zone') {
    const lastKlineX = canvasManager.indexToX(klines.length - 1);
    const extensionDistance = CHART_CONFIG.PATTERN_EXTENSION_DISTANCE;
    const targetX = lastKlineX + extensionDistance;

    if (x2 < targetX) {
      x2 = targetX;
    }
  }

  return isPointInRect(mousePoint, {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  });
};

export const testChannelPatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
): boolean => {
  if (!('upperLine' in pattern) || !('lowerLine' in pattern)) return false;

  const upperPoint1 = pattern.upperLine[0];
  const upperPoint2 = pattern.upperLine[1];
  const lowerPoint1 = pattern.lowerLine[0];
  const lowerPoint2 = pattern.lowerLine[1];

  const upperIndex1 = klines.findIndex(c => c.openTime >= upperPoint1.openTime);
  const upperIndex2 = klines.findIndex(c => c.openTime >= upperPoint2.openTime);
  const lowerIndex1 = klines.findIndex(c => c.openTime >= lowerPoint1.openTime);
  const lowerIndex2 = klines.findIndex(c => c.openTime >= lowerPoint2.openTime);

  if (upperIndex1 === -1 || upperIndex2 === -1 || lowerIndex1 === -1 || lowerIndex2 === -1) return false;

  const vertices = [
    { x: canvasManager.indexToCenterX(upperIndex1), y: canvasManager.priceToY(upperPoint1.price) },
    { x: canvasManager.indexToCenterX(upperIndex2), y: canvasManager.priceToY(upperPoint2.price) },
    { x: canvasManager.indexToCenterX(lowerIndex2), y: canvasManager.priceToY(lowerPoint2.price) },
    { x: canvasManager.indexToCenterX(lowerIndex1), y: canvasManager.priceToY(lowerPoint1.price) }
  ];

  return isPointInPolygon(mousePoint, vertices) || isPointNearPolygonEdge(mousePoint, vertices);
};

export const testTrianglePatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
): boolean => {
  if (!('upperTrendline' in pattern) || !('lowerTrendline' in pattern)) return false;

  const allPoints = [...pattern.upperTrendline, ...pattern.lowerTrendline];
  if ('apex' in pattern && pattern.apex) allPoints.push(pattern.apex);

  const coords = allPoints
    .map(p => {
      const idx = klines.findIndex(c => c.openTime >= p.openTime);
      if (idx === -ONE) return null;
      return {
        x: canvasManager.indexToCenterX(idx),
        y: canvasManager.priceToY(p.price)
      };
    })
    .filter((c): c is HitTestPoint => c !== null);

  if (coords.length < MIN_POLYGON_VERTICES) return false;

  const upperLine = coords.slice(ZERO, UPPER_LINE_COUNT);
  const lowerLine = coords.slice(UPPER_LINE_COUNT, TRIANGLE_VERTEX_COUNT);

  if (!upperLine[ZERO] || !upperLine[ONE] || !lowerLine[ZERO] || !lowerLine[ONE]) return false;

  const isNearUpperLine = isPointNearLine(mousePoint, upperLine[ZERO], upperLine[ONE]);
  const isNearLowerLine = isPointNearLine(mousePoint, lowerLine[ZERO], lowerLine[ONE]);

  if (isNearUpperLine || isNearLowerLine) return true;

  const polygon = [
    upperLine[ZERO],
    upperLine[ONE],
    lowerLine[ONE],
    lowerLine[ZERO]
  ];

  return isPointInPolygon(mousePoint, polygon);
};

export const testFibonacciPatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
): boolean => {
  if (!('startPoint' in pattern) || !('endPoint' in pattern) || !('levels' in pattern)) return false;

  const startIndex = klines.findIndex(c => c.openTime >= pattern.startPoint.openTime);
  const endIndex = klines.findIndex(c => c.openTime >= pattern.endPoint.openTime);

  if (startIndex === -1 || endIndex === -1) return false;

  const x1 = canvasManager.indexToCenterX(startIndex);
  const x2 = canvasManager.indexToCenterX(endIndex);

  for (const level of pattern.levels) {
    const y = canvasManager.priceToY(level.price);
    
    if (isPointNearLine(
      mousePoint,
      { x: x1, y },
      { x: x2, y }
    )) {
      return true;
    }
  }

  return false;
};

export const testPatternFormationHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[]
  // eslint-disable-next-line complexity
): boolean => {
  let allPoints: { openTime: number; price: number }[] = [];

  if (pattern.type === 'head-and-shoulders' || pattern.type === 'inverse-head-and-shoulders') {
    if ('leftShoulder' in pattern && 'head' in pattern && 'rightShoulder' in pattern) {
      allPoints = [pattern.leftShoulder, pattern.head, pattern.rightShoulder];
      if ('neckline' in pattern && pattern.neckline) {
        allPoints.push(...pattern.neckline);
      }
    }
  } else if (pattern.type === 'double-top' || pattern.type === 'double-bottom') {
    if ('firstPeak' in pattern && 'secondPeak' in pattern) {
      allPoints = [pattern.firstPeak, pattern.secondPeak];
      if ('neckline' in pattern && pattern.neckline) {
        allPoints.push(pattern.neckline);
      }
    }
  } else if (pattern.type === 'triple-top' || pattern.type === 'triple-bottom') {
    if ('peak1' in pattern && 'peak2' in pattern && 'peak3' in pattern) {
      allPoints = [pattern.peak1, pattern.peak2, pattern.peak3];
      if ('neckline' in pattern && pattern.neckline) {
        allPoints.push(...pattern.neckline);
      }
    }
  } else if (pattern.type === 'flag-bullish' || pattern.type === 'flag-bearish') {
    if ('flagpole' in pattern && 'flag' in pattern) {
      allPoints = [
        pattern.flagpole.start,
        pattern.flagpole.end,
        ...pattern.flag.upperTrendline,
        ...pattern.flag.lowerTrendline
      ];
    }
  } else if (pattern.type === 'pennant') {
    if ('flagpole' in pattern && 'pennant' in pattern) {
      allPoints = [
        pattern.flagpole.start,
        pattern.flagpole.end,
        ...pattern.pennant.upperTrendline,
        ...pattern.pennant.lowerTrendline
      ];
      if ('apex' in pattern.pennant && pattern.pennant.apex) {
        allPoints.push(pattern.pennant.apex);
      }
    }
  } else if (pattern.type === 'wedge-rising' || pattern.type === 'wedge-falling') {
    if ('upperTrendline' in pattern && 'lowerTrendline' in pattern) {
      allPoints = [...pattern.upperTrendline, ...pattern.lowerTrendline];
      if ('convergencePoint' in pattern && pattern.convergencePoint) {
        allPoints.push(pattern.convergencePoint);
      }
    }
  } else if (pattern.type === 'cup-and-handle') {
    if ('cupStart' in pattern && 'cupBottom' in pattern && 'cupEnd' in pattern &&
        'handleStart' in pattern && 'handleLow' in pattern && 'handleEnd' in pattern) {
      allPoints = [
        pattern.cupStart,
        pattern.cupBottom,
        pattern.cupEnd,
        pattern.handleStart,
        pattern.handleLow,
        pattern.handleEnd
      ];
    }
  } else if (pattern.type === 'rounding-bottom') {
    if ('start' in pattern && 'bottom' in pattern && 'end' in pattern) {
      allPoints = [pattern.start, pattern.bottom, pattern.end];
    }
  } else if (pattern.type === 'gap-common' || pattern.type === 'gap-breakaway' || 
             pattern.type === 'gap-runaway' || pattern.type === 'gap-exhaustion') {
    if ('gapStart' in pattern && 'gapEnd' in pattern) {
      allPoints = [pattern.gapStart, pattern.gapEnd];
    }
  }

  if (allPoints.length === 0) return false;

  const coords = allPoints
    .map(p => {
      const idx = klines.findIndex(c => c.openTime >= p.openTime);
      if (idx === -1) return null;
      return {
        x: canvasManager.indexToCenterX(idx),
        y: canvasManager.priceToY(p.price)
      };
    })
    .filter((c): c is HitTestPoint => c !== null);

  if (coords.length < MIN_LINE_POINTS) return false;

  for (let i = ZERO; i < coords.length - ONE; i++) {
    const currentPoint = coords[i];
    const nextPoint = coords[i + ONE];
    if (currentPoint && nextPoint && isPointNearLine(mousePoint, currentPoint, nextPoint)) {
      return true;
    }
  }

  if (coords.length >= MIN_POLYGON_VERTICES) {
    return isPointInPolygon(mousePoint, coords) || isPointNearPolygonEdge(mousePoint, coords);
  }

  return false;
};

export const testPatternHit = (
  pattern: AIPattern,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  klines: Kline[],
  tagBounds?: { x: number; y: number; width: number; height: number }
): boolean => {
  if (tagBounds && isPointInRect(mousePoint, {
    x: tagBounds.x - TAG_HIT_PADDING,
    y: tagBounds.y - TAG_HIT_PADDING,
    width: tagBounds.width + TAG_HIT_PADDING * TAG_PADDING_MULTIPLIER,
    height: tagBounds.height + TAG_HIT_PADDING * TAG_PADDING_MULTIPLIER
  })) {
    return true;
  }

  if ('topPrice' in pattern) {
    return testZonePatternHit(pattern, mousePoint, canvasManager, klines);
  }

  if ('points' in pattern) {
    return testLinePatternHit(pattern, mousePoint, canvasManager, klines);
  }

  if ('upperLine' in pattern && 'lowerLine' in pattern) {
    if (pattern.type.includes('channel')) {
      return testChannelPatternHit(pattern, mousePoint, canvasManager, klines);
    }
    if (pattern.type.includes('triangle')) {
      return testTrianglePatternHit(pattern, mousePoint, canvasManager, klines);
    }
  }

  if ('startPoint' in pattern && 'endPoint' in pattern && 'levels' in pattern) {
    return testFibonacciPatternHit(pattern, mousePoint, canvasManager, klines);
  }

  return testPatternFormationHit(pattern, mousePoint, canvasManager, klines);
};
