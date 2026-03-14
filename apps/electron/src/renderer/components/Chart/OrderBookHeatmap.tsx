import { Box } from '@chakra-ui/react';
import type { DepthLevel } from '@marketmind/types';
import { useEffect, useRef, useCallback } from 'react';

interface OrderBookHeatmapProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  width?: number;
  height?: number;
}

const HISTORY_SIZE = 300;

interface DepthSnapshot {
  bids: DepthLevel[];
  asks: DepthLevel[];
  timestamp: number;
}

export function OrderBookHeatmap({ bids, asks, width = 600, height = 200 }: OrderBookHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<DepthSnapshot[]>([]);

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

    ctx.clearRect(0, 0, width, height);

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
          ctx.fillStyle = `rgba(38, 166, 154, ${intensity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(239, 83, 80, ${intensity * 0.8})`;
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
    <Box borderTop="1px solid" borderColor="border.muted">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
      />
    </Box>
  );
}
