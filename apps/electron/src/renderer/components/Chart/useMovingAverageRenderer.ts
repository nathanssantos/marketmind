import { calculateMovingAverage } from '@marketmind/indicators';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG, LINE_WIDTHS } from '@shared/constants/chartConfig';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

export interface MovingAverageConfig {
  period: number;
  type: 'SMA' | 'EMA';
  color: string;
  lineWidth?: number;
  visible?: boolean;
}

export interface UseMovingAverageRendererProps {
  manager: CanvasManager | null;
  movingAverages?: MovingAverageConfig[];
  rightMargin?: number;
  hoveredMAIndexRef?: RefObject<number | undefined>;
  maValuesCache?: Map<string, (number | null)[]>;
}

export interface MATagHitbox {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseMovingAverageRendererReturn {
  render: () => void;
  getHoveredMATag: (x: number, y: number) => number | undefined;
}

export const useMovingAverageRenderer = ({
  manager,
  movingAverages = [],
  rightMargin,
  hoveredMAIndexRef,
  maValuesCache,
}: UseMovingAverageRendererProps): UseMovingAverageRendererReturn => {
  const tagHitboxesRef = useRef<MATagHitbox[]>([]);
  const localCacheRef = useRef<Map<string, (number | null)[]>>(new Map());

  useEffect(() => {
    localCacheRef.current.clear();
  }, [maValuesCache]);

  const render = useCallback((): void => {
    if (!manager || movingAverages.length === 0) return;

    tagHitboxesRef.current = [];

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !bounds || !klines) return;

    const { chartWidth } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - (rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

    const priceTags: Array<{ priceText: string; y: number; fillColor: string; index: number }> = [];

    const getMAValues = (ma: MovingAverageConfig): (number | null)[] => {
      const cacheKey = `${ma.type}-${ma.period}`;
      if (maValuesCache?.has(cacheKey)) return maValuesCache.get(cacheKey)!;
      if (localCacheRef.current.has(cacheKey)) return localCacheRef.current.get(cacheKey)!;
      const values = calculateMovingAverage(klines, ma.period, ma.type);
      localCacheRef.current.set(cacheKey, values);
      return values;
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dimensions.chartWidth, dimensions.chartHeight);
    ctx.clip();

    movingAverages.forEach((ma, index) => {
      if (ma.visible === false) return;

      const values = getMAValues(ma);
      const isHovered = hoveredMAIndexRef?.current === index;

      ctx.strokeStyle = ma.color;
      ctx.lineWidth = isHovered ? (ma.lineWidth || LINE_WIDTHS.NORMAL) + 1 : (ma.lineWidth || LINE_WIDTHS.NORMAL);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      if (isHovered) {
        ctx.shadowColor = ma.color;
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();

      let hasMovedTo = false;

      for (let i = startIndex; i < endIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = manager.indexToX(i);
        
        const centerX = x + klineCenterOffset;
        const y = manager.priceToY(value);

        if (!hasMovedTo) {
          ctx.moveTo(centerX, y);
          hasMovedTo = true;
        } else {
          ctx.lineTo(centerX, y);
        }
      }

      ctx.stroke();
      
      if (isHovered) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    });

    ctx.restore();

    movingAverages.forEach((ma, index) => {
      if (ma.visible === false) return;

      const values = getMAValues(ma);
      const lastVisibleIndex = endIndex - 1;
      const lastVisibleValue = values[lastVisibleIndex];
      
      if (lastVisibleValue === null || lastVisibleValue === undefined) return;

      const y = manager.priceToY(lastVisibleValue);
      const priceText = formatChartPrice(lastVisibleValue);
      
      const fillColor = ma.color.replace(/[\d.]+\)$/, '0.9)');
      
      priceTags.push({ priceText, y, fillColor, index });
    });

    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    priceTags.forEach(({ priceText, y, fillColor, index }) => {
      if (y < 0 || y > dimensions.chartHeight) return;

      const tagStartX = chartWidth;
      const tagSize = drawPriceTag(ctx, priceText, y, tagStartX, fillColor, CHART_CONFIG.CANVAS_PADDING_RIGHT);
      
      tagHitboxesRef.current.push({
        index,
        x: tagStartX,
        y: y - tagSize.height / 2,
        width: tagSize.width,
        height: tagSize.height,
      });
    });

    ctx.restore();
  }, [manager, movingAverages, rightMargin, maValuesCache]);

  const getHoveredMATag = useCallback((x: number, y: number): number | undefined => {
    if (!tagHitboxesRef.current) return undefined;
    for (const hitbox of tagHitboxesRef.current) {
      if (
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height
      ) {
        return hitbox.index;
      }
    }
    return undefined;
  }, []);

  return { render, getHoveredMATag };
};
