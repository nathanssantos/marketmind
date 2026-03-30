import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { HEATMAP_MAX_BUCKETS } from '@marketmind/types';
import type { LiquidityHeatmapBucket, LiquidityHeatmapSnapshot } from '@marketmind/types';
import { socketService } from '../services/socketService';

export const useLiquidityHeatmap = (
  symbol: string | null,
  enabled = true
): { dataRef: MutableRefObject<LiquidityHeatmapSnapshot | null> } => {
  const dataRef = useRef<LiquidityHeatmapSnapshot | null>(null);

  useEffect(() => {
    if (!symbol || !enabled) {
      dataRef.current = null;
      return;
    }

    const socket = socketService.connect();
    dataRef.current = null;
    socket.emit('subscribe:liquidityHeatmap', symbol);

    const snapshotHandler = (snapshot: LiquidityHeatmapSnapshot) => {
      dataRef.current = snapshot;
    };

    const bucketHandler = (data: {
      symbol: string;
      bucket: LiquidityHeatmapBucket;
      priceBinSize: number;
      maxQuantity: number;
    }) => {
      const current = dataRef.current;
      if (!current) {
        dataRef.current = {
          symbol: data.symbol,
          priceBinSize: data.priceBinSize,
          buckets: [data.bucket],
          maxQuantity: data.maxQuantity,
          liquidations: [],
          estimatedLevels: [],
        };
        return;
      }

      const lastIdx = current.buckets.length - 1;
      if (lastIdx >= 0 && current.buckets[lastIdx]!.time === data.bucket.time) {
        current.buckets[lastIdx] = data.bucket;
      } else {
        current.buckets.push(data.bucket);
        if (current.buckets.length > HEATMAP_MAX_BUCKETS) current.buckets.splice(0, current.buckets.length - HEATMAP_MAX_BUCKETS);
      }
      current.maxQuantity = data.maxQuantity;
      current.priceBinSize = data.priceBinSize;
    };

    socket.on('liquidityHeatmap:snapshot', snapshotHandler);
    socket.on('liquidityHeatmap:bucket', bucketHandler);

    return () => {
      socket.off('liquidityHeatmap:snapshot', snapshotHandler);
      socket.off('liquidityHeatmap:bucket', bucketHandler);
      socket.emit('unsubscribe:liquidityHeatmap', symbol);
      dataRef.current = null;
      socketService.disconnect();
    };
  }, [symbol, enabled]);

  return { dataRef };
};
