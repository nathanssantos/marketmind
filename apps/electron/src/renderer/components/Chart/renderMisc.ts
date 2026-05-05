import type { Order, TradingSetup } from '@marketmind/types';
import { calculateLiquidationPrice } from '@marketmind/types';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { ORDER_LINE_COLORS } from '@shared/constants';
import { getOrderPrice, getOrderQuantity, isOrderActive, isOrderLong } from '@shared/utils';

import {
  drawHorizontalLine,
  drawInfoTag,
  drawProfitLossArea,
  isSLInProfitZone,
  setStandardFont,
} from './orderLineDrawing';
import type { GroupedPosition, TrailingStopLineConfig } from './orderLineTypes';
import { PRICE_TAG_WIDTH } from './orderLineTypes';
import type { RenderContext } from './renderContext';
import { getDirectionArrow } from './utils/directionArrow';
import { PRICE_TAG_HEIGHT, resolvePriceTagCollisions } from './utils/priceTagCollision';
import { drainPriceTagBuffer } from './utils/priceTagBuffer';

export const renderPendingSetups = (
  rc: RenderContext,
  pendingSetups: TradingSetup[]
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;

  pendingSetups.forEach((setup) => {
    if (!setup.visible) return;

    const effectiveEntryPrice = setup.entryOrderType === 'LIMIT' && setup.limitEntryPrice
      ? setup.limitEntryPrice
      : setup.entryPrice;

    const entryY = manager.priceToY(effectiveEntryPrice);
    if (entryY < 0 || entryY > chartHeight) return;

    const isLong = setup.direction === 'LONG';
    const isLimitOrder = setup.entryOrderType === 'LIMIT';

    if (rc.showProfitLossAreas && (setup.stopLoss || setup.takeProfit)) {
      const entryX = manager.indexToX(setup.klineIndex);

      if (setup.stopLoss) {
        const slY = manager.priceToY(setup.stopLoss);
        const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
        drawProfitLossArea(ctx, entryY, slY, chartWidth, slIsProfit, entryX);
      }
      if (setup.takeProfit) {
        const tpY = manager.priceToY(setup.takeProfit);
        drawProfitLossArea(ctx, entryY, tpY, chartWidth, true, entryX);
      }
    }

    ctx.save();
    setStandardFont(ctx);

    const lineColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_LINE : ORDER_LINE_COLORS.PENDING_SHORT_LINE;
    const fillColor = isLong ? ORDER_LINE_COLORS.PENDING_LONG_FILL : ORDER_LINE_COLORS.PENDING_SHORT_FILL;

    const priceText = formatChartPrice(effectiveEntryPrice);
    rc.priceTags.push({ priceText, y: entryY, fillColor });

    drawHorizontalLine(ctx, entryY, chartWidth, lineColor);

    const setupLabel = setup.label ?? setup.type;
    const directionSymbol = getDirectionArrow(isLong, manager.isFlipped());
    const orderTypeLabel = isLimitOrder ? 'LIMIT' : 'MKT';
    const infoText = `${directionSymbol} ${setupLabel} (${orderTypeLabel})`;

    drawInfoTag(ctx, infoText, entryY, lineColor, rc.infoTagBg, rc.infoTagText, false, null, 'bot');

    if (setup.stopLoss) {
      const slY = manager.priceToY(setup.stopLoss);
      const slIsProfit = isSLInProfitZone(isLong, effectiveEntryPrice, setup.stopLoss);
      const slLineColor = slIsProfit ? ORDER_LINE_COLORS.SETUP_PROFIT_LINE : ORDER_LINE_COLORS.SETUP_LOSS_LINE;
      const slLossSetupColor = ORDER_LINE_COLORS.SL_LOSS_LINE;
      const slTagColor = slIsProfit ? ORDER_LINE_COLORS.SL_PROFIT_LINE : slLossSetupColor;

      drawHorizontalLine(ctx, slY, chartWidth, slLineColor);

      const slPriceText = formatChartPrice(setup.stopLoss);
      const slPercent = isLong
        ? ((setup.stopLoss - effectiveEntryPrice) / effectiveEntryPrice) * 100
        : ((effectiveEntryPrice - setup.stopLoss) / effectiveEntryPrice) * 100;
      const slInfoText = `SL (${slPercent.toFixed(2)}%)`;

      rc.priceTags.push({ priceText: slPriceText, y: slY, fillColor: slTagColor });
      drawInfoTag(ctx, slInfoText, slY, slTagColor, rc.infoTagBg, rc.infoTagText, false, null, null);
    }

    if (setup.takeProfit) {
      const tpY = manager.priceToY(setup.takeProfit);
      drawHorizontalLine(ctx, tpY, chartWidth, ORDER_LINE_COLORS.SETUP_PROFIT_LINE);

      const tpPriceText = formatChartPrice(setup.takeProfit);
      const tpPercent = isLong
        ? ((setup.takeProfit - effectiveEntryPrice) / effectiveEntryPrice) * 100
        : ((effectiveEntryPrice - setup.takeProfit) / effectiveEntryPrice) * 100;
      const tpInfoText = `TP (${tpPercent >= 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`;

      const tpSetupFillColor = ORDER_LINE_COLORS.TP_FILL;
      rc.priceTags.push({ priceText: tpPriceText, y: tpY, fillColor: tpSetupFillColor });
      drawInfoTag(ctx, tpInfoText, tpY, tpSetupFillColor, rc.infoTagBg, rc.infoTagText, false, null, null);
    }

    ctx.restore();
  });
};

export const renderTrailingStops = (
  rc: RenderContext,
  activeOrders: Order[],
  trailingStopConfig: TrailingStopLineConfig
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;
  const openPositions = activeOrders.filter(o => isOrderActive(o));
  const positionsByKey = new Map<string, { side: 'long' | 'short'; avgPrice: number; totalQty: number }>();

  for (const order of openPositions) {
    const side = isOrderLong(order) ? 'long' as const : 'short' as const;
    const qty = getOrderQuantity(order);
    const existing = positionsByKey.get(side);
    if (existing) {
      const newTotalQty = existing.totalQty + qty;
      existing.avgPrice = (existing.avgPrice * existing.totalQty + getOrderPrice(order) * qty) / newTotalQty;
      existing.totalQty = newTotalQty;
    } else {
      positionsByKey.set(side, { side, avgPrice: getOrderPrice(order), totalQty: qty });
    }
  }

  for (const pos of positionsByKey.values()) {
    const activationPercent = pos.side === 'long'
      ? trailingStopConfig.activationPercentLong
      : trailingStopConfig.activationPercentShort;
    if (activationPercent <= 0) continue;

    const activationPrice = pos.avgPrice * activationPercent;
    const tsY = manager.priceToY(activationPrice);
    if (tsY < 0 || tsY > chartHeight) continue;

    const activationPctDisplay = ((activationPercent - 1) * 100);
    const pctSign = activationPctDisplay >= 0 ? '+' : '';
    const tsArrow = getDirectionArrow(pos.side === 'long', manager.isFlipped());
    const tsLabel = `TS ${tsArrow} (${pctSign}${activationPctDisplay.toFixed(1)}%)`;

    ctx.save();
    ctx.strokeStyle = ORDER_LINE_COLORS.TRAILING_STOP_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, tsY);
    ctx.lineTo(chartWidth, tsY);
    ctx.stroke();
    ctx.setLineDash([]);

    setStandardFont(ctx);
    const tsCloseBtn = { x: 0, y: 0, size: 14 };
    drawInfoTag(ctx, tsLabel, tsY, ORDER_LINE_COLORS.TRAILING_STOP_FILL, rc.infoTagBg, rc.infoTagText, true, tsCloseBtn, 'shield');
    rc.tsCloseButtons.push(tsCloseBtn);

    const tsPriceText = formatChartPrice(activationPrice);
    rc.priceTags.push({ priceText: tsPriceText, y: tsY, fillColor: ORDER_LINE_COLORS.TRAILING_STOP_FILL });

    ctx.restore();
  }
};

export const renderLiquidationLines = (
  rc: RenderContext,
  allPositions: GroupedPosition[]
): void => {
  const { ctx, manager, chartWidth, chartHeight } = rc;

  allPositions.forEach((position) => {
    if (position.leverage <= 1) return;
    const isLong = position.netQuantity > 0;
    const side = isLong ? 'LONG' as const : 'SHORT' as const;
    const liqPrice = position.liquidationPrice ?? calculateLiquidationPrice(position.avgPrice, position.leverage, side);
    if (liqPrice <= 0) return;

    const liqY = manager.priceToY(liqPrice);
    if (liqY < 0 || liqY > chartHeight) return;

    ctx.save();
    ctx.strokeStyle = ORDER_LINE_COLORS.LIQUIDATION_LINE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, liqY);
    ctx.lineTo(chartWidth, liqY);
    ctx.stroke();
    ctx.setLineDash([]);

    setStandardFont(ctx);
    const liqArrow = getDirectionArrow(side === 'LONG', manager.isFlipped());
    const liqLabel = `LIQ ${liqArrow}`;
    drawInfoTag(ctx, liqLabel, liqY, ORDER_LINE_COLORS.LIQUIDATION_FILL, rc.infoTagBg, rc.infoTagText, false);

    const liqPriceText = formatChartPrice(liqPrice);
    rc.priceTags.push({ priceText: liqPriceText, y: liqY, fillColor: ORDER_LINE_COLORS.LIQUIDATION_FILL });

    ctx.restore();
  });
};

export const renderPriceTags = (
  rc: RenderContext
): void => {
  const { ctx, chartWidth, chartHeight, currentPriceTag, stackPriceTags } = rc;

  type Combined = {
    priceText: string;
    y: number;
    fillColor: string;
    flashAlpha?: number;
    width: number;
    textColor?: string;
  };
  const indicatorTags = drainPriceTagBuffer(rc.manager);
  const orderTags: Combined[] = rc.priceTags.map((t) => ({
    priceText: t.priceText,
    y: t.y,
    fillColor: t.fillColor,
    flashAlpha: t.flashAlpha,
    width: PRICE_TAG_WIDTH,
  }));
  const indicatorTagsTyped: Combined[] = indicatorTags.map((t) => ({
    priceText: t.priceText,
    y: t.y,
    fillColor: t.fillColor,
    width: t.width,
    textColor: t.textColor,
  }));
  const all = [...orderTags, ...indicatorTagsTyped].filter((t) => t.y >= 0 && t.y <= chartHeight);

  const resolvedYs = stackPriceTags
    ? resolvePriceTagCollisions({
        tags: all.map((t) => ({ y: t.y, height: PRICE_TAG_HEIGHT })),
        fixedAnchor: currentPriceTag,
        chartHeight,
      })
    : all.map((t) => t.y);

  all.forEach(({ priceText, fillColor, flashAlpha: tagFlash, width, textColor }, i) => {
    const y = resolvedYs[i] ?? 0;
    const tagSize = drawPriceTag(ctx, priceText, y, chartWidth, fillColor, width, textColor);
    if (tagFlash && tagFlash > 0) {
      ctx.save();
      ctx.globalAlpha = tagFlash;
      ctx.fillStyle = ORDER_LINE_COLORS.FLASH_OVERLAY;
      ctx.fillRect(chartWidth, y - tagSize.height / 2, width, tagSize.height);
      ctx.restore();
      rc.needsAnimation = true;
    }
  });
};
