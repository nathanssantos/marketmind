import { useMemo } from 'react';

export interface SetupMarker {
  x: number;
  y: number;
  type: 'entry' | 'exit' | 'stopLoss' | 'takeProfit';
  price: number;
  time: number;
  profit?: number;
  profitPercent?: number;
}

export interface TradeMarker {
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface UseTradeVisualizationProps {
  trades: TradeMarker[];
  viewport: {
    start: number;
    end: number;
    minPrice: number;
    maxPrice: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  showStopLoss?: boolean;
  showTakeProfit?: boolean;
}

export interface UseTradeVisualizationResult {
  markers: SetupMarker[];
  visibleMarkers: SetupMarker[];
  tradeMarkers: SetupMarker[];
  slLines: unknown[];
  tpLines: unknown[];
  profitableCount: number;
  losingCount: number;
  totalProfit: number;
}

const calculateMarkerPosition = (
  time: number,
  price: number,
  viewport: UseTradeVisualizationProps['viewport'],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } => {
  const viewportWidth = viewport.end - viewport.start;
  const x = ((time - viewport.start) / viewportWidth) * canvasWidth;

  const priceRange = viewport.maxPrice - viewport.minPrice;
  const y = ((viewport.maxPrice - price) / priceRange) * canvasHeight;

  return { x, y };
};

export const useTradeVisualization = ({
  trades,
  viewport,
  canvasWidth,
  canvasHeight,
  showStopLoss = true,
  showTakeProfit = true,
}: UseTradeVisualizationProps): UseTradeVisualizationResult => {
  const markers = useMemo(() => {
    const result: SetupMarker[] = [];

    trades.forEach((trade) => {
      const entryPos = calculateMarkerPosition(
        trade.entryTime,
        trade.entryPrice,
        viewport,
        canvasWidth,
        canvasHeight
      );

      result.push({
        ...entryPos,
        type: 'entry',
        price: trade.entryPrice,
        time: trade.entryTime,
      });

      if (trade.exitTime && trade.exitPrice) {
        const exitPos = calculateMarkerPosition(
          trade.exitTime,
          trade.exitPrice,
          viewport,
          canvasWidth,
          canvasHeight
        );

        const profit = trade.exitPrice - trade.entryPrice;
        const profitPercent = (profit / trade.entryPrice) * 100;

        result.push({
          ...exitPos,
          type: 'exit',
          price: trade.exitPrice,
          time: trade.exitTime,
          profit,
          profitPercent,
        });
      }

      if (showStopLoss && trade.stopLoss) {
        const slPos = calculateMarkerPosition(
          trade.entryTime,
          trade.stopLoss,
          viewport,
          canvasWidth,
          canvasHeight
        );

        result.push({
          ...slPos,
          type: 'stopLoss',
          price: trade.stopLoss,
          time: trade.entryTime,
        });
      }

      if (showTakeProfit && trade.takeProfit) {
        const tpPos = calculateMarkerPosition(
          trade.entryTime,
          trade.takeProfit,
          viewport,
          canvasWidth,
          canvasHeight
        );

        result.push({
          ...tpPos,
          type: 'takeProfit',
          price: trade.takeProfit,
          time: trade.entryTime,
        });
      }
    });

    return result;
  }, [trades, viewport, canvasWidth, canvasHeight, showStopLoss, showTakeProfit]);

  const visibleMarkers = useMemo(() => {
    return markers.filter(
      (marker) =>
        marker.time >= viewport.start &&
        marker.time <= viewport.end &&
        marker.price >= viewport.minPrice &&
        marker.price <= viewport.maxPrice
    );
  }, [markers, viewport]);

  const stats = useMemo(() => {
    let profitableCount = 0;
    let losingCount = 0;
    let totalProfit = 0;

    trades.forEach((trade) => {
      if (trade.exitTime && trade.exitPrice) {
        const profit = trade.exitPrice - trade.entryPrice;
        totalProfit += profit;

        if (profit > 0) {
          profitableCount++;
        } else if (profit < 0) {
          losingCount++;
        }
      }
    });

    return { profitableCount, losingCount, totalProfit };
  }, [trades]);

  return {
    markers,
    visibleMarkers,
    tradeMarkers: markers,
    slLines: [],
    tpLines: [],
    profitableCount: stats.profitableCount,
    losingCount: stats.losingCount,
    totalProfit: stats.totalProfit,
  };
};
