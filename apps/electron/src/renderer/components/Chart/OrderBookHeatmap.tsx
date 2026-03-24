import { Box } from '@chakra-ui/react';
import type { DepthLevel } from '@marketmind/types';
import { INDICATOR_COLORS } from '@shared/constants';
import { useEffect, useRef, useCallback, useState } from 'react';

interface OrderBookHeatmapProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  width?: number;
  height?: number;
}

const HISTORY_SIZE = 300;

const parseRgba = (rgba: string): [number, number, number] => {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const [BID_R, BID_G, BID_B] = parseRgba(INDICATOR_COLORS.ORDERBOOK_BID);
const [ASK_R, ASK_G, ASK_B] = parseRgba(INDICATOR_COLORS.ORDERBOOK_ASK);

interface DepthSnapshot {
  bids: DepthLevel[];
  asks: DepthLevel[];
  timestamp: number;
}

export function OrderBookHeatmap({ bids, asks, width = 600, height: heightProp }: OrderBookHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<DepthSnapshot[]>([]);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const height = heightProp ?? measuredHeight;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || heightProp) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setMeasuredHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [heightProp]);

  useEffect(() => {
    if (bids.length === 0 && asks.length === 0) return;

    historyRef.current.push({ bids: [...bids], asks: [...asks], timestamp: Date.now() });
    if (historyRef.current.length > HISTORY_SIZE) historyRef.current.shift();
  }, [bids, asks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const history = historyRef.current;
    if (history.length === 0) return;

    ctx.fillStyle = INDICATOR_COLORS.ORDERBOOK_BG;
    ctx.fillRect(0, 0, width, height);

    let globalMinPrice = Infinity;
    let globalMaxPrice = -Infinity;
    let globalMaxQty = 0;

    for (const snap of history) {
      for (const l of snap.bids) {
        if (l.price < globalMinPrice) globalMinPrice = l.price;
        if (l.price > globalMaxPrice) globalMaxPrice = l.price;
        if (l.quantity > globalMaxQty) globalMaxQty = l.quantity;
      }
      for (const l of snap.asks) {
        if (l.price < globalMinPrice) globalMinPrice = l.price;
        if (l.price > globalMaxPrice) globalMaxPrice = l.price;
        if (l.quantity > globalMaxQty) globalMaxQty = l.quantity;
      }
    }

    if (globalMinPrice === Infinity || globalMaxQty === 0) return;

    const priceRange = globalMaxPrice - globalMinPrice;
    if (priceRange <= 0) return;

    const colWidth = width / history.length;

    for (let i = 0; i < history.length; i++) {
      const snap = history[i]!;
      const x = i * colWidth;

      const allLevels = [...snap.bids, ...snap.asks];
      for (const level of allLevels) {
        const y = height - ((level.price - globalMinPrice) / priceRange) * height;
        const intensity = Math.min(1, level.quantity / globalMaxQty);

        const isBid = snap.bids.includes(level);
        if (isBid) {
          ctx.fillStyle = `rgba(${BID_R}, ${BID_G}, ${BID_B}, ${intensity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(${ASK_R}, ${ASK_G}, ${ASK_B}, ${intensity * 0.8})`;
        }

        const cellHeight = Math.max(1, height / 50);
        ctx.fillRect(x, y - cellHeight / 2, colWidth, cellHeight);
      }
    }
  }, [width, height]);

  useEffect(() => {
    const interval = setInterval(draw, 200);
    return () => clearInterval(interval);
  }, [draw]);

  return (
    <Box ref={containerRef} flex={1} minH={0} position="relative">
      {height > 0 && (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
        />
      )}
    </Box>
  );
}
