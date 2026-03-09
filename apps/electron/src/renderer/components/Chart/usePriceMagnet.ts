import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { BackendExecution } from './useOrderLinesRenderer';
import { useCallback, useMemo } from 'react';

interface AdhesionPoint {
  price: number;
  source: 'round-number' | 'order-entry' | 'stop-loss' | 'take-profit';
}

interface UsePriceMagnetProps {
  manager: CanvasManager | null;
  enabled: boolean;
  snapDistancePx: number;
  executions: BackendExecution[];
  tickSize?: number;
}

interface SnapResult {
  price: number;
  snapped: boolean;
  source?: AdhesionPoint['source'];
}

const getRoundNumberStep = (price: number): number => {
  if (price >= 10000) return 100;
  if (price >= 1000) return 50;
  if (price >= 100) return 10;
  if (price >= 10) return 1;
  if (price >= 1) return 0.1;
  if (price >= 0.1) return 0.01;
  if (price >= 0.01) return 0.001;
  return 0.0001;
};

export const usePriceMagnet = ({ manager, enabled, snapDistancePx, executions, tickSize }: UsePriceMagnetProps) => {
  const adhesionPoints = useMemo((): AdhesionPoint[] => {
    const points: AdhesionPoint[] = [];

    for (const exec of executions) {
      if (exec.status !== 'open' && exec.status !== 'pending') continue;
      points.push({ price: parseFloat(exec.entryPrice), source: 'order-entry' });
      if (exec.stopLoss) points.push({ price: parseFloat(exec.stopLoss), source: 'stop-loss' });
      if (exec.takeProfit) points.push({ price: parseFloat(exec.takeProfit), source: 'take-profit' });
    }

    return points;
  }, [executions]);

  const getSnappedPrice = useCallback((rawY: number): SnapResult => {
    if (!manager || !enabled) {
      const price = manager?.yToPrice(rawY) ?? 0;
      return { price, snapped: false };
    }

    const rawPrice = manager.yToPrice(rawY);

    const allPoints: AdhesionPoint[] = [...adhesionPoints];

    const step = tickSize && tickSize > 0 ? tickSize : getRoundNumberStep(rawPrice);
    const nearestRound = Math.round(rawPrice / step) * step;
    const roundAbove = nearestRound + step;
    const roundBelow = nearestRound - step;
    allPoints.push(
      { price: nearestRound, source: 'round-number' },
      { price: roundAbove, source: 'round-number' },
      { price: roundBelow, source: 'round-number' },
    );

    let closestPoint: AdhesionPoint | null = null;
    let closestDistancePx = Infinity;

    for (const point of allPoints) {
      const pointY = manager.priceToY(point.price);
      const distPx = Math.abs(pointY - rawY);
      if (distPx < closestDistancePx) {
        closestDistancePx = distPx;
        closestPoint = point;
      }
    }

    if (closestPoint && closestDistancePx <= snapDistancePx) {
      return { price: closestPoint.price, snapped: true, source: closestPoint.source };
    }

    return { price: rawPrice, snapped: false };
  }, [manager, enabled, snapDistancePx, adhesionPoints, tickSize]);

  return { getSnappedPrice };
};
