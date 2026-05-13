import type { CoordinateMapper, LongPositionDrawing, ShortPositionDrawing } from '@marketmind/chart-studies';

const ENTRY_COLOR = '#2196F3';
const PROFIT_COLOR = 'rgba(34, 197, 94, 0.15)';
const LOSS_COLOR = 'rgba(239, 68, 68, 0.15)';
const PROFIT_LINE_COLOR = '#22c55e';
const LOSS_LINE_COLOR = '#ef4444';
const LABEL_FONT = '11px monospace';
const BADGE_FONT = '10px monospace';
const BADGE_HEIGHT = 16;
const BADGE_PADDING = 4;
const BADGE_RADIUS = 3;
const LINE_DASH = [4, 3];
const LABEL_MARGIN_RIGHT = 8;
const TICKET_BTN_WIDTH = 56;
const TICKET_BTN_HEIGHT = 18;
const TICKET_BTN_GAP = 6;
const TICKET_BTN_RADIUS = 4;
const TICKET_BTN_FONT = 'bold 10px monospace';

/**
 * Rect of the "→ Ticket" badge a click handler outside the renderer
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

const formatPercent = (entry: number, target: number): string => {
  const pct = ((target - entry) / entry) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
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

export const renderPosition = (
  ctx: CanvasRenderingContext2D,
  drawing: LongPositionDrawing | ShortPositionDrawing,
  mapper: CoordinateMapper,
  isSelected: boolean,
  chartWidth: number,
  ticketButtonRef?: TicketButtonRef,
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

  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'middle';

  const labelX = chartWidth - LABEL_MARGIN_RIGHT;
  ctx.textAlign = 'right';

  ctx.fillStyle = color;
  const dirLabel = isLong ? 'LONG' : 'SHORT';
  ctx.fillText(`${dirLabel} ${formatPrice(entryPrice)}`, labelX, entryY - 2);

  ctx.fillStyle = LOSS_LINE_COLOR;
  ctx.fillText(`SL ${formatPrice(stopLossPrice)}`, labelX, slY - 2);

  ctx.fillStyle = PROFIT_LINE_COLOR;
  ctx.fillText(`TP ${formatPrice(takeProfitPrice)}`, labelX, tpY - 2);

  ctx.font = BADGE_FONT;
  const slPctText = formatPercent(entryPrice, stopLossPrice);
  const tpPctText = formatPercent(entryPrice, takeProfitPrice);
  const rrText = formatRR(entryPrice, stopLossPrice, takeProfitPrice);

  const drawBadge = (text: string, x: number, y: number, bgColor: string) => {
    const w = ctx.measureText(text).width + BADGE_PADDING * 2;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x - w, y - BADGE_HEIGHT / 2, w, BADGE_HEIGHT, BADGE_RADIUS);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(text, x - BADGE_PADDING, y);
  };

  const slBadgeColor = isSlProfit ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
  const tpBadgeColor = isTpProfit ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';

  drawBadge(slPctText, labelX, slY + 14, slBadgeColor);
  drawBadge(tpPctText, labelX, tpY + 14, tpBadgeColor);

  const rrMidY = (entryY + tpY) / 2;
  ctx.font = BADGE_FONT;
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.fillText(rrText, labelX, rrMidY);

  // "→ Ticket" badge sitting just to the LEFT of the entry-price label.
  // Anchored on the entry line so the user reads it as "feed this entry
  // setup into the ticket". Renders for every long/short projection;
  // hit-tested via the rect we populate on `ticketButtonRef`.
  const entryLabelWidth = ctx.measureText(`${dirLabel} ${formatPrice(entryPrice)}`).width;
  const ticketBtnX = labelX - entryLabelWidth - TICKET_BTN_GAP - TICKET_BTN_WIDTH;
  const ticketBtnY = entryY - TICKET_BTN_HEIGHT / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(ticketBtnX, ticketBtnY, TICKET_BTN_WIDTH, TICKET_BTN_HEIGHT, TICKET_BTN_RADIUS);
  ctx.fill();
  ctx.font = TICKET_BTN_FONT;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('→ TICKET', ticketBtnX + TICKET_BTN_WIDTH / 2, entryY);
  ctx.textBaseline = 'alphabetic';
  if (ticketButtonRef) {
    ticketButtonRef.x = ticketBtnX;
    ticketButtonRef.y = ticketBtnY;
    ticketButtonRef.width = TICKET_BTN_WIDTH;
    ticketButtonRef.height = TICKET_BTN_HEIGHT;
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
