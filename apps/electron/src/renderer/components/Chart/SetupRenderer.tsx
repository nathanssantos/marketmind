import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { Kline, TradingSetup } from '@marketmind/types';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SetupRendererProps {
  canvasManager: CanvasManager | null;
  klines: Kline[];
  setups: TradingSetup[];
  width: number;
  height: number;
  mousePosition: { x: number; y: number } | null;
  onSetupHover: (setup: TradingSetup | null) => void;
  advancedConfig?: {
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
  };
}

const SETUP_TAG_FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
const SETUP_TAG_PADDING = 4;
const LINE_WIDTH = 2;
const DASH_PATTERN_LARGE = 5;
const DASH_PATTERN_SMALL = 3;
const HIT_THRESHOLD = 5;
const HIT_THRESHOLD_MULTIPLIER = 3;
const CIRCLE_RADIUS = 4;
const CIRCLE_FULL_ANGLE = 2;
const DEFAULT_ALPHA = 0.7;
const TAG_OFFSET_X = 8;
const TEXT_HEIGHT = 16;
const HALF_DIVISOR = 2;

const DIRECTION_COLORS = {
  LONG: {
    entry: '#22c55e',
    stopLoss: '#ef4444',
    takeProfit: '#3b82f6',
    tag: '#22c55e',
  },
  SHORT: {
    entry: '#ef4444',
    stopLoss: '#22c55e',
    takeProfit: '#3b82f6',
    tag: '#ef4444',
  },
} as const;

export const SetupRenderer = ({
  canvasManager,
  klines,
  setups,
  width,
  height,
  mousePosition,
  onSetupHover,
}: SetupRendererProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSetup, setHoveredSetup] = useState<TradingSetup | null>(null);
  const setupTagsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const lastHoveredIdRef = useRef<string | null>(null);

  const checkTagHit = useCallback((tagBounds: { x: number; y: number; width: number; height: number } | undefined, mouseX: number, mouseY: number): boolean => {
    if (!tagBounds) return false;
    return mouseX >= tagBounds.x && mouseX <= tagBounds.x + tagBounds.width && mouseY >= tagBounds.y && mouseY <= tagBounds.y + tagBounds.height;
  }, []);

  const checkSetupHit = useCallback((setup: TradingSetup, mouseX: number, mouseY: number, manager: CanvasManager, klinesData: Kline[]): boolean => {
    const klineIndex = setup.klineIndex;
    const kline = klinesData[klineIndex];
    if (!kline) return false;

    const x = manager.indexToCenterX(klineIndex);
    const yEntry = manager.priceToY(setup.entryPrice);
    const ySL = manager.priceToY(setup.stopLoss);
    const yTP = manager.priceToY(setup.takeProfit);

    if (Math.abs(mouseX - x) < HIT_THRESHOLD * HIT_THRESHOLD_MULTIPLIER) {
      if (Math.abs(mouseY - yEntry) < HIT_THRESHOLD || Math.abs(mouseY - ySL) < HIT_THRESHOLD || Math.abs(mouseY - yTP) < HIT_THRESHOLD) {
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (!canvasManager || klines.length === 0 || !mousePosition) {
      const newId = null;
      if (lastHoveredIdRef.current !== newId) {
        lastHoveredIdRef.current = newId;
        setHoveredSetup(null);
        onSetupHover(null);
      }
      return;
    }

    const { x: mouseX, y: mouseY } = mousePosition;
    let found: TradingSetup | null = null;

    for (const setup of setups) {
      if (!setup.visible) continue;

      const tagBounds = setupTagsRef.current.get(setup.id);
      if (checkTagHit(tagBounds, mouseX, mouseY)) {
        found = setup;
        break;
      }

      if (checkSetupHit(setup, mouseX, mouseY, canvasManager, klines)) {
        found = setup;
        break;
      }
    }

    const newId = found?.id ?? null;
    if (lastHoveredIdRef.current !== newId) {
      lastHoveredIdRef.current = newId;
      setHoveredSetup(found);
      onSetupHover(found);
    }
  }, [canvasManager, klines, setups, mousePosition, onSetupHover, checkTagHit, checkSetupHit]);

  const drawSetupTag = useCallback((ctx: CanvasRenderingContext2D, setup: TradingSetup, x: number, y: number, color: string): void => {
    ctx.font = SETUP_TAG_FONT;
    ctx.textBaseline = 'middle';

    const label = setup.label ?? `${setup.type} ${setup.direction}`;
    const rrText = `R:R ${setup.riskRewardRatio.toFixed(1)}`;
    const confText = `${Math.round(setup.confidence)}%`;
    const text = `${label} | ${rrText} | ${confText}`;

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const boxWidth = textWidth + SETUP_TAG_PADDING * HALF_DIVISOR;
    const boxHeight = TEXT_HEIGHT + SETUP_TAG_PADDING;

    const tagX = x + TAG_OFFSET_X;
    const tagY = y - boxHeight / HALF_DIVISOR;

    ctx.fillStyle = color;
    ctx.fillRect(tagX, tagY, boxWidth, boxHeight);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, tagX + SETUP_TAG_PADDING, tagY + boxHeight / HALF_DIVISOR);

    setupTagsRef.current.set(setup.id, {
      x: tagX,
      y: tagY,
      width: boxWidth,
      height: boxHeight,
    });
  }, []);

  const drawSetup = useCallback((ctx: CanvasRenderingContext2D, setup: TradingSetup, manager: CanvasManager, klinesData: Kline[], isHovered: boolean): void => {
    const klineIndex = setup.klineIndex;
    const kline = klinesData[klineIndex];
    if (!kline) return;

    const x = manager.indexToCenterX(klineIndex);
    const yEntry = manager.priceToY(setup.entryPrice);
    const ySL = manager.priceToY(setup.stopLoss);
    const yTP = manager.priceToY(setup.takeProfit);

    const colors = DIRECTION_COLORS[setup.direction];
    const alpha = isHovered ? 1 : DEFAULT_ALPHA;
    const lineWidth = isHovered ? LINE_WIDTH + 1 : LINE_WIDTH;

    const dimensions = manager.getDimensions();
    if (!dimensions) return;
    const chartRight = dimensions.chartWidth;

    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;

    ctx.strokeStyle = colors.entry;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, yEntry);
    ctx.lineTo(chartRight, yEntry);
    ctx.stroke();

    ctx.strokeStyle = colors.stopLoss;
    ctx.setLineDash([DASH_PATTERN_LARGE, DASH_PATTERN_SMALL]);
    ctx.beginPath();
    ctx.moveTo(x, ySL);
    ctx.lineTo(chartRight, ySL);
    ctx.stroke();

    ctx.strokeStyle = colors.takeProfit;
    ctx.setLineDash([DASH_PATTERN_LARGE, DASH_PATTERN_SMALL]);
    ctx.beginPath();
    ctx.moveTo(x, yTP);
    ctx.lineTo(chartRight, yTP);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.strokeStyle = colors.tag;
    ctx.fillStyle = colors.tag;
    ctx.beginPath();
    ctx.arc(x, yEntry, CIRCLE_RADIUS, 0, Math.PI * CIRCLE_FULL_ANGLE);
    ctx.fill();
    ctx.stroke();

    drawSetupTag(ctx, setup, x, yEntry, colors.tag);

    ctx.globalAlpha = 1;
  }, [drawSetupTag]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasManager || klines.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (setups.length === 0) {
      return;
    }

    const dimensions = canvasManager.getDimensions();
    if (!dimensions) return;

    const clipWidth = dimensions.chartWidth;
    const clipHeight = dimensions.chartHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, clipWidth, clipHeight);
    ctx.clip();

    setupTagsRef.current.clear();

    setups.forEach((setup) => {
      if (!setup.visible) return;

      const isHovered = hoveredSetup?.id === setup.id;
      drawSetup(ctx, setup, canvasManager, klines, isHovered);
    });

    ctx.restore();
  }, [canvasManager, klines, setups, width, height, hoveredSetup, drawSetup]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  );
};
