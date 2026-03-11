import type { Kline } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { getKlineOpen, getKlineHigh, getKlineLow, getKlineClose } from '@shared/utils';
import { useCallback } from 'react';

const SNAP_PIXEL_THRESHOLD = 12;
const INDEX_RANGE = 3;

interface OHLCSnapResult {
  snappedIndex: number;
  snappedPrice: number;
  snapped: boolean;
  ohlcType: 'open' | 'high' | 'low' | 'close' | null;
}

interface UseOHLCMagnetProps {
  manager: CanvasManager | null;
  klines: Kline[];
  enabled: boolean;
}

export const useOHLCMagnet = ({ manager, klines, enabled }: UseOHLCMagnetProps) => {
  const snap = useCallback((mouseX: number, mouseY: number): OHLCSnapResult => {
    if (!enabled || !manager || klines.length === 0) {
      if (!manager) return { snappedIndex: 0, snappedPrice: 0, snapped: false, ohlcType: null };
      const viewport = manager.getViewport();
      const dimensions = manager.getDimensions();
      if (!viewport || !dimensions) return { snappedIndex: 0, snappedPrice: 0, snapped: false, ohlcType: null };

      const rawIndex = viewport.start + (mouseX / dimensions.chartWidth) * (viewport.end - viewport.start);
      const index = Math.round(rawIndex);
      const price = manager.yToPrice(mouseY);
      return { snappedIndex: index, snappedPrice: price, snapped: false, ohlcType: null };
    }

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    if (!viewport || !dimensions) return { snappedIndex: 0, snappedPrice: 0, snapped: false, ohlcType: null };

    const rawIndex = viewport.start + (mouseX / dimensions.chartWidth) * (viewport.end - viewport.start);
    const centerIndex = Math.round(rawIndex);

    let bestDist = Infinity;
    let bestIndex = centerIndex;
    let bestPrice = manager.yToPrice(mouseY);
    let bestType: OHLCSnapResult['ohlcType'] = null;

    const startIdx = Math.max(0, centerIndex - INDEX_RANGE);
    const endIdx = Math.min(klines.length - 1, centerIndex + INDEX_RANGE);

    for (let i = startIdx; i <= endIdx; i++) {
      const kline = klines[i];
      if (!kline) continue;

      const cx = manager.indexToCenterX(i);

      const candidates: Array<{ price: number; type: 'open' | 'high' | 'low' | 'close' }> = [
        { price: getKlineOpen(kline), type: 'open' },
        { price: getKlineHigh(kline), type: 'high' },
        { price: getKlineLow(kline), type: 'low' },
        { price: getKlineClose(kline), type: 'close' },
      ];

      for (const { price, type } of candidates) {
        const py = manager.priceToY(price);
        const dx = mouseX - cx;
        const dy = mouseY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist && dist < SNAP_PIXEL_THRESHOLD) {
          bestDist = dist;
          bestIndex = i;
          bestPrice = price;
          bestType = type;
        }
      }
    }

    return {
      snappedIndex: bestIndex,
      snappedPrice: bestType ? bestPrice : manager.yToPrice(mouseY),
      snapped: bestType !== null,
      ohlcType: bestType,
    };
  }, [manager, klines, enabled]);

  return { snap };
};
