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

/** Position record emitted while drawing — used for hit-testing in M1.1. */
export interface PatternHitDraw {
  hit: PatternHit;
  /** Glyph center x (canvas coords). */
  x: number;
  /** Glyph center y (canvas coords). */
  y: number;
}

/**
 * Draw glyphs for every pattern hit. Multiple hits on the same bar stack
 * vertically (decision 3). Bullish glyphs draw below the bar low; bearish
 * above the bar high; neutral as a small circle near the bar high.
 *
 * When `draws` is provided, the renderer pushes a `PatternHitDraw` record
 * for every glyph so a downstream click handler can hit-test against the
 * visible positions. The array is cleared on entry so callers can reuse a
 * single ref across frames.
 */
export const renderCandlePatterns = (
  ctx: CanvasRenderingContext2D,
  manager: CanvasManager,
  klines: readonly Kline[],
  hits: readonly PatternHit[],
  colors: ChartThemeColors,
  draws?: PatternHitDraw[],
): void => {
  if (draws) draws.length = 0;
  if (hits.length === 0) return;
  const dims = manager.getDimensions();
  if (!dims) return;

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
    // Center the glyph on the candle wick (vertical line through OHLC).
    // `indexToX` returns the slot's left edge; `indexToCenterX` returns the
    // wick's x — that's where the bar's high / low / open / close are
    // visually located.
    const x = manager.indexToCenterX(index);
    if (x < 0 || x > dims.chartWidth) continue;

    const yHigh = manager.priceToY(Number(kline.high));
    const yLow = manager.priceToY(Number(kline.low));

    // Bullish glyphs always anchor to the LOW-price side of the bar (yLow);
    // bearish always to the HIGH-price side (yHigh). The flip only inverts
    // which screen direction those sides face — yLow sits at the screen
    // bottom when not flipped (so the glyph stacks DOWNWARD past yLow), and
    // at the screen top when flipped (so the glyph stacks UPWARD past yLow).
    // Same idea, mirrored, for bearish around yHigh.
    let bullishOffset = 0;
    let bearishOffset = 0;
    let neutralOffset = 0;
    for (const hit of group) {
      const color = colorForSentiment(hit.sentiment, colors);
      let glyphY: number;
      if (hit.sentiment === 'bullish') {
        glyphY = flipped
          ? yLow - GLYPH_OFFSET - bullishOffset
          : yLow + GLYPH_OFFSET + bullishOffset;
        // Triangle still semantically points UP (bullish direction), but on
        // a flipped chart "up" visually means screen-down, so we draw the
        // mirrored triangle to keep the orientation consistent with the bar.
        drawTriangle(ctx, x, glyphY, flipped ? 'down' : 'up', GLYPH_SIZE, color);
        bullishOffset += GLYPH_SIZE + GLYPH_GAP;
      } else if (hit.sentiment === 'bearish') {
        glyphY = flipped
          ? yHigh + GLYPH_OFFSET + bearishOffset
          : yHigh - GLYPH_OFFSET - bearishOffset;
        drawTriangle(ctx, x, glyphY, flipped ? 'up' : 'down', GLYPH_SIZE, color);
        bearishOffset += GLYPH_SIZE + GLYPH_GAP;
      } else {
        // Neutral always sits OUTSIDE the visual top of the bar — yHigh is
        // the screen top in normal mode, yLow is the screen top when flipped.
        glyphY = (flipped ? yLow : yHigh) - NEUTRAL_OFFSET - neutralOffset;
        drawCircle(ctx, x, glyphY, GLYPH_SIZE, color);
        neutralOffset += GLYPH_SIZE + GLYPH_GAP;
      }
      draws?.push({ hit, x, y: glyphY });
    }
  }
};

/**
 * Find the topmost glyph within `tolerance` pixels of (x, y). Used by the
 * click handler in ChartCanvas to surface a pattern info popover.
 * Iterates last-to-first so glyphs drawn later (= visually on top of
 * stacked glyphs) win the hit.
 */
export const findPatternHitAtPosition = (
  draws: readonly PatternHitDraw[],
  x: number,
  y: number,
  tolerance = 10,
): PatternHitDraw | null => {
  for (let i = draws.length - 1; i >= 0; i--) {
    const d = draws[i]!;
    const dx = d.x - x;
    const dy = d.y - y;
    if (dx * dx + dy * dy <= tolerance * tolerance) return d;
  }
  return null;
};
