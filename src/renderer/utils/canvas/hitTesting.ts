import { CHART_CONFIG } from '@shared/constants';
import type { AIStudy, Candle } from '@shared/types';
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

export const testLineStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
): boolean => {
  if (!('points' in study)) return false;

  const [point1, point2] = study.points;
  const index1 = candles.findIndex(c => c.timestamp >= point1.timestamp);
  const index2 = candles.findIndex(c => c.timestamp >= point2.timestamp);

  if (index1 === -1 || index2 === -1) return false;

  const x1 = canvasManager.indexToCenterX(index1);
  const x2 = canvasManager.indexToCenterX(index2);
  const y1 = canvasManager.priceToY(point1.price);
  const y2 = canvasManager.priceToY(point2.price);

  let finalX2 = x2;
  let finalY2 = y2;

  if (study.type === 'support' || study.type === 'resistance') {
    const lastCandleX = canvasManager.indexToX(candles.length - 1);
    const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
    const targetX = lastCandleX + extensionDistance;

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

export const testZoneStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
): boolean => {
  if (!('topPrice' in study)) return false;

  const startIndex = candles.findIndex(c => c.timestamp >= study.startTimestamp);
  const endIndex = candles.findIndex(c => c.timestamp >= study.endTimestamp);

  if (startIndex === -1 || endIndex === -1) return false;

  const x1 = canvasManager.indexToCenterX(startIndex);
  let x2 = canvasManager.indexToCenterX(endIndex);
  const y1 = canvasManager.priceToY(study.topPrice);
  const y2 = canvasManager.priceToY(study.bottomPrice);

  if (study.type === 'buy-zone' || study.type === 'sell-zone' || 
      study.type === 'liquidity-zone' || study.type === 'accumulation-zone') {
    const lastCandleX = canvasManager.indexToX(candles.length - 1);
    const extensionDistance = CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
    const targetX = lastCandleX + extensionDistance;

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

export const testChannelStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
): boolean => {
  if (!('upperLine' in study) || !('lowerLine' in study)) return false;

  const upperPoint1 = study.upperLine[0];
  const upperPoint2 = study.upperLine[1];
  const lowerPoint1 = study.lowerLine[0];
  const lowerPoint2 = study.lowerLine[1];

  const upperIndex1 = candles.findIndex(c => c.timestamp >= upperPoint1.timestamp);
  const upperIndex2 = candles.findIndex(c => c.timestamp >= upperPoint2.timestamp);
  const lowerIndex1 = candles.findIndex(c => c.timestamp >= lowerPoint1.timestamp);
  const lowerIndex2 = candles.findIndex(c => c.timestamp >= lowerPoint2.timestamp);

  if (upperIndex1 === -1 || upperIndex2 === -1 || lowerIndex1 === -1 || lowerIndex2 === -1) return false;

  const vertices = [
    { x: canvasManager.indexToCenterX(upperIndex1), y: canvasManager.priceToY(upperPoint1.price) },
    { x: canvasManager.indexToCenterX(upperIndex2), y: canvasManager.priceToY(upperPoint2.price) },
    { x: canvasManager.indexToCenterX(lowerIndex2), y: canvasManager.priceToY(lowerPoint2.price) },
    { x: canvasManager.indexToCenterX(lowerIndex1), y: canvasManager.priceToY(lowerPoint1.price) }
  ];

  return isPointInPolygon(mousePoint, vertices) || isPointNearPolygonEdge(mousePoint, vertices);
};

export const testTriangleStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
): boolean => {
  if (!('upperTrendline' in study) || !('lowerTrendline' in study)) return false;

  const allPoints = [...study.upperTrendline, ...study.lowerTrendline];
  if ('apex' in study && study.apex) allPoints.push(study.apex);

  const coords = allPoints
    .map(p => {
      const idx = candles.findIndex(c => c.timestamp >= p.timestamp);
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

export const testFibonacciStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
): boolean => {
  if (!('startPoint' in study) || !('endPoint' in study) || !('levels' in study)) return false;

  const startIndex = candles.findIndex(c => c.timestamp >= study.startPoint.timestamp);
  const endIndex = candles.findIndex(c => c.timestamp >= study.endPoint.timestamp);

  if (startIndex === -1 || endIndex === -1) return false;

  const x1 = canvasManager.indexToCenterX(startIndex);
  const x2 = canvasManager.indexToCenterX(endIndex);

  for (const level of study.levels) {
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

export const testPatternStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[]
  // eslint-disable-next-line complexity
): boolean => {
  let allPoints: { timestamp: number; price: number }[] = [];

  if (study.type === 'head-and-shoulders' || study.type === 'inverse-head-and-shoulders') {
    if ('leftShoulder' in study && 'head' in study && 'rightShoulder' in study) {
      allPoints = [study.leftShoulder, study.head, study.rightShoulder];
      if ('neckline' in study && study.neckline) {
        allPoints.push(...study.neckline);
      }
    }
  } else if (study.type === 'double-top' || study.type === 'double-bottom') {
    if ('firstPeak' in study && 'secondPeak' in study) {
      allPoints = [study.firstPeak, study.secondPeak];
      if ('neckline' in study && study.neckline) {
        allPoints.push(study.neckline);
      }
    }
  } else if (study.type === 'triple-top' || study.type === 'triple-bottom') {
    if ('peak1' in study && 'peak2' in study && 'peak3' in study) {
      allPoints = [study.peak1, study.peak2, study.peak3];
      if ('neckline' in study && study.neckline) {
        allPoints.push(...study.neckline);
      }
    }
  } else if (study.type === 'flag-bullish' || study.type === 'flag-bearish') {
    if ('flagpole' in study && 'flag' in study) {
      allPoints = [
        study.flagpole.start,
        study.flagpole.end,
        ...study.flag.upperTrendline,
        ...study.flag.lowerTrendline
      ];
    }
  } else if (study.type === 'pennant') {
    if ('flagpole' in study && 'pennant' in study) {
      allPoints = [
        study.flagpole.start,
        study.flagpole.end,
        ...study.pennant.upperTrendline,
        ...study.pennant.lowerTrendline
      ];
      if ('apex' in study.pennant && study.pennant.apex) {
        allPoints.push(study.pennant.apex);
      }
    }
  } else if (study.type === 'wedge-rising' || study.type === 'wedge-falling') {
    if ('upperTrendline' in study && 'lowerTrendline' in study) {
      allPoints = [...study.upperTrendline, ...study.lowerTrendline];
      if ('convergencePoint' in study && study.convergencePoint) {
        allPoints.push(study.convergencePoint);
      }
    }
  } else if (study.type === 'cup-and-handle') {
    if ('cupStart' in study && 'cupBottom' in study && 'cupEnd' in study &&
        'handleStart' in study && 'handleLow' in study && 'handleEnd' in study) {
      allPoints = [
        study.cupStart,
        study.cupBottom,
        study.cupEnd,
        study.handleStart,
        study.handleLow,
        study.handleEnd
      ];
    }
  } else if (study.type === 'rounding-bottom') {
    if ('start' in study && 'bottom' in study && 'end' in study) {
      allPoints = [study.start, study.bottom, study.end];
    }
  } else if (study.type === 'gap-common' || study.type === 'gap-breakaway' || 
             study.type === 'gap-runaway' || study.type === 'gap-exhaustion') {
    if ('gapStart' in study && 'gapEnd' in study) {
      allPoints = [study.gapStart, study.gapEnd];
    }
  }

  if (allPoints.length === 0) return false;

  const coords = allPoints
    .map(p => {
      const idx = candles.findIndex(c => c.timestamp >= p.timestamp);
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

export const testStudyHit = (
  study: AIStudy,
  mousePoint: HitTestPoint,
  canvasManager: CanvasManager,
  candles: Candle[],
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

  if ('topPrice' in study) {
    return testZoneStudyHit(study, mousePoint, canvasManager, candles);
  }

  if ('points' in study) {
    return testLineStudyHit(study, mousePoint, canvasManager, candles);
  }

  if ('upperLine' in study && 'lowerLine' in study) {
    if (study.type.includes('channel')) {
      return testChannelStudyHit(study, mousePoint, canvasManager, candles);
    }
    if (study.type.includes('triangle')) {
      return testTriangleStudyHit(study, mousePoint, canvasManager, candles);
    }
  }

  if ('startPoint' in study && 'endPoint' in study && 'levels' in study) {
    return testFibonacciStudyHit(study, mousePoint, canvasManager, candles);
  }

  return testPatternStudyHit(study, mousePoint, canvasManager, candles);
};
