import type { CoordinateMapper, LongPositionDrawing, ShortPositionDrawing } from '@marketmind/chart-studies';

const ENTRY_COLOR = '#2196F3';
const PROFIT_COLOR = 'rgba(34, 197, 94, 0.15)';
const LOSS_COLOR = 'rgba(239, 68, 68, 0.15)';
const PROFIT_LINE_COLOR = '#22c55e';
const LOSS_LINE_COLOR = '#ef4444';
const WARNING_COLOR = '#f59e0b';
const LABEL_FONT = '11px monospace';
const BADGE_FONT = '10px monospace';
const BADGE_HEIGHT = 16;
const BADGE_PADDING = 4;
const BADGE_RADIUS = 3;
const LINE_DASH = [4, 3];
const LABEL_MARGIN_RIGHT = 8;
const LABEL_PILL_PAD_X = 5;
const LABEL_PILL_PAD_Y = 2;
const LABEL_PILL_BG = 'rgba(0, 0, 0, 0.55)';
// 11px font + 2px pad-y each side = ~15px pill. Stack the pill ABOVE the
// line (entry/SL/TP) so the dashed price line doesn't cut through text.
// Center of pill sits 11px above the line.
const LABEL_LINE_OFFSET = 11;
const TICKET_BTN_SIZE = 18;
const TICKET_BTN_GAP = 6;
const TICKET_BTN_RADIUS = 4;
const TICKET_BTN_FONT = 'bold 12px monospace';
const RR_BLOCK_LINE_HEIGHT = 14;
const RR_BLOCK_PAD_X = 6;
const RR_BLOCK_PAD_Y = 4;
const RR_BLOCK_RADIUS = 3;
const RR_BLOCK_BG = 'rgba(0, 0, 0, 0.55)';

/**
 * Rect of the "→" Ticket button a click handler outside the renderer
 * (`useChartInteraction`) can hit-test against. Populated by side-effect
 * during `renderPosition`. The renderer doesn't own the hit-test
 * pipeline — see `useDrawingsRenderer`'s `ticketButtonsRef` for the
 * canvas-level array that aggregates one entry per long/short
 * projection drawing.
 */
export interface TicketButtonRef {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Live risk readout for the drawing's Risk-% label. `null` when sizing
 * info (active wallet balance, sizePercent, leverage) isn't available
 * yet — the renderer skips the Risk line entirely in that case. The
 * warning icon is drawn when `exposurePercent > warningThresholdPct`
 * (default 2% — configurable in Settings → Chart → Risk warning %).
 */
export interface PositionRiskContext {
  exposurePercent: number;
  warningThresholdPct: number;
}

/**
 * % change from entry to target, **signed by directional P&L** (not by raw
 * price delta). For a LONG the price-delta sign already matches P&L;
 * for a SHORT the sign flips — selling at entry and buying back at a
 * LOWER price is profit, so the badge should show `+` even though
 * `target < entry`. The previous implementation reported raw price-delta
 * percent, which showed `-` on the SHORT TP (a profit) and `+` on the
 * SHORT SL (a loss) — exactly inverted from the trader's mental model
 * and from how the colored region is tinted.
 */
const formatPercent = (entry: number, target: number, isLong: boolean): string => {
  const rawPct = ((target - entry) / entry) * 100;
  const pnlPct = isLong ? rawPct : -rawPct;
  return `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`;
};

const formatRR = (entry: number, sl: number, tp: number): string => {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 'R:R --';
  const reward = Math.abs(tp - entry);
  return `R:R 1:${(reward / risk).toFixed(2)}`;
};

const formatPrice = (price: number): string => {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
};

const drawPillLabel = (
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  centerY: number,
  textColor: string,
): void => {
  const metrics = ctx.measureText(text);
  const w = metrics.width + LABEL_PILL_PAD_X * 2;
  const h = 11 + LABEL_PILL_PAD_Y * 2;
  ctx.fillStyle = LABEL_PILL_BG;
  ctx.beginPath();
  ctx.roundRect(rightX - w, centerY - h / 2, w, h, BADGE_RADIUS);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rightX - LABEL_PILL_PAD_X, centerY);
};

export const renderPosition = (
  ctx: CanvasRenderingContext2D,
  drawing: LongPositionDrawing | ShortPositionDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  ticketButtonRef?: TicketButtonRef,
  risk?: PositionRiskContext | null,
): void => {
  const isLong = drawing.type === 'longPosition';
  const { entryPrice, stopLossPrice, takeProfitPrice, entryIndex } = drawing;
  const color = drawing.color ?? ENTRY_COLOR;

  const entryY = mapper.priceToY(entryPrice);
  const slY = mapper.priceToY(stopLossPrice);
  const tpY = mapper.priceToY(takeProfitPrice);
  const startX = mapper.indexToCenterX(entryIndex);

  const isSlProfit = isLong ? stopLossPrice > entryPrice : stopLossPrice < entryPrice;
  const isTpProfit = isLong ? takeProfitPrice > entryPrice : takeProfitPrice < entryPrice;

  ctx.save();

  // Tinted regions for the SL and TP halves.
  const slFill = isSlProfit ? PROFIT_COLOR : LOSS_COLOR;
  const tpFill = isTpProfit ? PROFIT_COLOR : LOSS_COLOR;
  const slMinY = Math.min(entryY, slY);
  const slMaxY = Math.max(entryY, slY);
  ctx.fillStyle = slFill;
  ctx.fillRect(startX, slMinY, chartWidth - startX, slMaxY - slMinY);
  const tpMinY = Math.min(entryY, tpY);
  const tpMaxY = Math.max(entryY, tpY);
  ctx.fillStyle = tpFill;
  ctx.fillRect(startX, tpMinY, chartWidth - startX, tpMaxY - tpMinY);

  // Three dashed horizontal price lines.
  const lineWidth = drawing.lineWidth ?? 1;
  ctx.setLineDash(LINE_DASH);
  ctx.lineWidth = lineWidth;

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(startX, entryY);
  ctx.lineTo(chartWidth, entryY);
  ctx.stroke();

  ctx.strokeStyle = LOSS_LINE_COLOR;
  ctx.beginPath();
  ctx.moveTo(startX, slY);
  ctx.lineTo(chartWidth, slY);
  ctx.stroke();

  ctx.strokeStyle = PROFIT_LINE_COLOR;
  ctx.beginPath();
  ctx.moveTo(startX, tpY);
  ctx.lineTo(chartWidth, tpY);
  ctx.stroke();

  ctx.setLineDash([]);

  // Right-aligned price labels sit in dark pills ABOVE each line (instead
  // of straddling them, the v1.22.7 behaviour that produced the readability
  // bug the user reported — every label was crossed by its own line).
  //
  // Layout near the entry line, anchored to `labelX`:
  //   [SHORT 79189.01]  [→]
  //                   ^ TICKET_BTN_GAP
  // The ticket button sits to the RIGHT of the entry pill (closer to the
  // axis), with the pill anchored to its left.
  ctx.font = LABEL_FONT;
  const labelX = chartWidth - LABEL_MARGIN_RIGHT;
  const dirLabel = isLong ? 'LONG' : 'SHORT';
  const entryText = `${dirLabel} ${formatPrice(entryPrice)}`;
  const slText = `SL ${formatPrice(stopLossPrice)}`;
  const tpText = `TP ${formatPrice(takeProfitPrice)}`;

  // Entry pill's right edge is offset LEFT to leave room for the ticket
  // button to its right. SL and TP pills use the full right margin.
  const entryPillRightX = labelX - TICKET_BTN_SIZE - TICKET_BTN_GAP;
  drawPillLabel(ctx, slText, labelX, slY - LABEL_LINE_OFFSET, LOSS_LINE_COLOR);
  drawPillLabel(ctx, entryText, entryPillRightX, entryY - LABEL_LINE_OFFSET, color);
  drawPillLabel(ctx, tpText, labelX, tpY - LABEL_LINE_OFFSET, PROFIT_LINE_COLOR);

  // Percent badges anchored BELOW each line (where the price-tag column on
  // the right edge would otherwise overlap them).
  ctx.font = BADGE_FONT;
  const slPctText = formatPercent(entryPrice, stopLossPrice, isLong);
  const tpPctText = formatPercent(entryPrice, takeProfitPrice, isLong);

  const drawBadge = (text: string, rightX: number, centerY: number, bgColor: string): void => {
    const w = ctx.measureText(text).width + BADGE_PADDING * 2;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(rightX - w, centerY - BADGE_HEIGHT / 2, w, BADGE_HEIGHT, BADGE_RADIUS);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rightX - BADGE_PADDING, centerY);
  };

  const slBadgeColor = isSlProfit ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
  const tpBadgeColor = isTpProfit ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
  // Sit the % badge BELOW the price pill (each pill is roughly 15px tall,
  // centered on `y - LABEL_LINE_OFFSET`, so the badge below the line at
  // `y + LABEL_LINE_OFFSET` puts it symmetric on the other side).
  drawBadge(slPctText, labelX, slY + LABEL_LINE_OFFSET, slBadgeColor);
  drawBadge(tpPctText, labelX, tpY + LABEL_LINE_OFFSET, tpBadgeColor);

  // Ticket button: icon-only "→" anchored to the RIGHT of the entry pill.
  // Slot reserved by the pill's `entryPillRightX` offset above.
  const ticketBtnX = labelX - TICKET_BTN_SIZE;
  const ticketBtnY = entryY - LABEL_LINE_OFFSET - TICKET_BTN_SIZE / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(ticketBtnX, ticketBtnY, TICKET_BTN_SIZE, TICKET_BTN_SIZE, TICKET_BTN_RADIUS);
  ctx.fill();
  ctx.font = TICKET_BTN_FONT;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('→', ticketBtnX + TICKET_BTN_SIZE / 2, ticketBtnY + TICKET_BTN_SIZE / 2);
  if (ticketButtonRef) {
    ticketButtonRef.x = ticketBtnX;
    ticketButtonRef.y = ticketBtnY;
    ticketButtonRef.width = TICKET_BTN_SIZE;
    ticketButtonRef.height = TICKET_BTN_SIZE;
  }

  // R:R + Risk% block, anchored in the TP half of the projection (the
  // "what you'll make" zone). Previously a bare line of text that
  // overlapped the chart's price grid — now in a dark pill, with the
  // risk-as-%-of-balance and an optional warning icon stacked below.
  ctx.font = BADGE_FONT;
  ctx.textBaseline = 'alphabetic';
  const rrText = formatRR(entryPrice, stopLossPrice, takeProfitPrice);
  const showRisk = risk !== null && risk !== undefined && Number.isFinite(risk.exposurePercent);
  const riskText = showRisk ? `Risk: ${risk.exposurePercent.toFixed(2)}%` : '';
  const exceedsWarning = showRisk && risk.exposurePercent > risk.warningThresholdPct;
  const riskTextWithIcon = exceedsWarning ? `⚠ ${riskText}` : riskText;

  const rrWidth = ctx.measureText(rrText).width;
  const riskWidth = riskTextWithIcon ? ctx.measureText(riskTextWithIcon).width : 0;
  const innerWidth = Math.max(rrWidth, riskWidth);
  const blockHeight = showRisk
    ? RR_BLOCK_LINE_HEIGHT * 2 + RR_BLOCK_PAD_Y * 2
    : RR_BLOCK_LINE_HEIGHT + RR_BLOCK_PAD_Y * 2;
  const blockWidth = innerWidth + RR_BLOCK_PAD_X * 2;
  const rrMidY = (entryY + tpY) / 2;
  const blockY = rrMidY - blockHeight / 2;
  const blockX = labelX - blockWidth;

  ctx.fillStyle = RR_BLOCK_BG;
  ctx.beginPath();
  ctx.roundRect(blockX, blockY, blockWidth, blockHeight, RR_BLOCK_RADIUS);
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const rrTextY = showRisk
    ? blockY + RR_BLOCK_PAD_Y + RR_BLOCK_LINE_HEIGHT / 2
    : blockY + blockHeight / 2;
  ctx.fillText(rrText, blockX + blockWidth - RR_BLOCK_PAD_X, rrTextY);

  if (showRisk) {
    ctx.fillStyle = exceedsWarning ? WARNING_COLOR : '#cbd5e0';
    const riskTextY = blockY + RR_BLOCK_PAD_Y + RR_BLOCK_LINE_HEIGHT + RR_BLOCK_LINE_HEIGHT / 2;
    ctx.fillText(riskTextWithIcon, blockX + blockWidth - RR_BLOCK_PAD_X, riskTextY);
  }

  if (isSelected) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.3;
    const allMinY = Math.min(entryY, slY, tpY);
    const allMaxY = Math.max(entryY, slY, tpY);
    ctx.strokeRect(startX, allMinY, chartWidth - startX, allMaxY - allMinY);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};
