import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { HEATMAP_MAX_BUCKETS } from '@marketmind/types';
import type { LiquidityHeatmapSnapshot } from '@marketmind/types';
import { useSocketEvent, useSymbolStreamSubscription } from './socket';

export const useLiquidityHeatmap = (
  symbol: string | null,
  enabled = true,
): { dataRef: MutableRefObject<LiquidityHeatmapSnapshot | null> } => {
  const dataRef = useRef<LiquidityHeatmapSnapshot | null>(null);

  useEffect(() => {
    dataRef.current = null;
  }, [symbol, enabled]);

  useSymbolStreamSubscription('liquidityHeatmap', enabled && symbol ? symbol : undefined);

  useSocketEvent(
    'liquidityHeatmap:snapshot',
    (snapshot) => {
      dataRef.current = snapshot;
    },
    enabled && !!symbol,
  );

  useSocketEvent(
    'liquidityHeatmap:bucket',
    (data) => {
      const current = dataRef.current;
      if (!current) {
        dataRef.current = {
          symbol: data.symbol,
          priceBinSize: data.priceBinSize ?? 0,
          buckets: [data.bucket],
          maxQuantity: data.maxQuantity ?? 0,
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
        if (current.buckets.length > HEATMAP_MAX_BUCKETS) {
          current.buckets.splice(0, current.buckets.length - HEATMAP_MAX_BUCKETS);
        }
      }
      if (data.maxQuantity !== undefined) current.maxQuantity = data.maxQuantity;
      if (data.priceBinSize !== undefined) current.priceBinSize = data.priceBinSize;
    },
    enabled && !!symbol,
  );

  return { dataRef };
};
