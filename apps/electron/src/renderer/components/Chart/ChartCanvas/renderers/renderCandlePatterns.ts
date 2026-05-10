import type { Kline } from '@marketmind/types';
import type { PatternHit } from '@marketmind/trading-core';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

const GLYPH_SIZE = 8;
const GLYPH_GAP = 4;
const GLYPH_OFFSET = 12;
const NEUTRAL_OFFSET = 6;

const colorForSentiment = (sentiment: PatternHit['sentiment'], colors: ChartThemeColors): string => {
  if (sentiment === 'bullish') return colors.bullish;
  if (sentiment === 'bearish') return colors.bearish;
  return colors.axisLabel;
};

const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pointing: 'up' | 'down',
  size: number,
  color: string,
): void => {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (pointing === 'up') {
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
  } else {
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x - size / 2, y - size / 2);
    ctx.lineTo(x + size / 2, y - size / 2);
  }
  ctx.closePath();
  ctx.fill();
};

const drawCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.stroke();
};

interface PatternHitDraw {
  hit: PatternHit;
  x: number;
  yHigh: number;
  yLow: number;
}

/**
 * Draw glyphs for every pattern hit. Multiple hits on the same bar stack
 * vertically (decision 3). Bullish glyphs draw below the bar low; bearish
 * above the bar high; neutral as a small circle near the bar high.
 */
export const renderCandlePatterns = (
  ctx: CanvasRenderingContext2D,
  manager: CanvasManager,
  klines: readonly Kline[],
  hits: readonly PatternHit[],
  colors: ChartThemeColors,
): void => {
  if (hits.length === 0) return;
  const dims = manager.getDimensions();
  if (!dims) return;

  // Group hits by bar index so we can stack glyphs.
  const byIndex = new Map<number, PatternHit[]>();
  for (const hit of hits) {
    const list = byIndex.get(hit.index);
    if (list) list.push(hit);
    else byIndex.set(hit.index, [hit]);
  }

  const flipped = manager.isFlipped();

  for (const [index, group] of byIndex) {
    const kline = klines[index];
    if (!kline) continue;
    const x = manager.indexToX(index);
    if (x < 0 || x > dims.chartWidth) continue;

    const yHigh = manager.priceToY(Number(kline.high));
    const yLow = manager.priceToY(Number(kline.low));

    let bullishOffset = 0;
    let bearishOffset = 0;
    let neutralOffset = 0;
    for (const hit of group) {
      const color = colorForSentiment(hit.sentiment, colors);
      if (hit.sentiment === 'bullish') {
        const baseY = flipped ? yHigh - GLYPH_OFFSET - bullishOffset : yLow + GLYPH_OFFSET + bullishOffset;
        drawTriangle(ctx, x, baseY, flipped ? 'down' : 'up', GLYPH_SIZE, color);
        bullishOffset += GLYPH_SIZE + GLYPH_GAP;
      } else if (hit.sentiment === 'bearish') {
        const baseY = flipped ? yLow + GLYPH_OFFSET + bearishOffset : yHigh - GLYPH_OFFSET - bearishOffset;
        drawTriangle(ctx, x, baseY, flipped ? 'up' : 'down', GLYPH_SIZE, color);
        bearishOffset += GLYPH_SIZE + GLYPH_GAP;
      } else {
        const baseY = (flipped ? yLow : yHigh) - NEUTRAL_OFFSET - neutralOffset;
        drawCircle(ctx, x, baseY, GLYPH_SIZE, color);
        neutralOffset += GLYPH_SIZE + GLYPH_GAP;
      }
    }
  }
};

/** Hit-test helper for hover tooltips: returns hits whose glyph is near (x, y). */
export const findPatternHitAtPosition = (
  hits: readonly PatternHit[],
  draws: readonly PatternHitDraw[],
  x: number,
  y: number,
  tolerance = 10,
): PatternHit | null => {
  for (let i = draws.length - 1; i >= 0; i--) {
    const d = draws[i]!;
    if (Math.abs(d.x - x) > tolerance) continue;
    // y can be near either yHigh-offset or yLow+offset depending on sentiment;
    // a wide vertical band is fine for tooltip discovery.
    if (y > d.yHigh - 30 && y < d.yLow + 30) return d.hit;
  }
  // Fallback: ignore draws and use raw hits index match.
  return hits[0] ?? null;
};
