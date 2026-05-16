/**
 * Per-CanvasManager buffer for price-scale tags drawn by indicator
 * renderers (EMAs, SMAs, Bollinger, Ichimoku, etc.) that don't share
 * the `RenderContext` of `useOrderLinesRenderer`. Tags pushed here are
 * picked up by `renderPriceTags` and pass through the same collision
 * resolution as order-line tags.
 *
 * The buffer is keyed by `CanvasManager` (WeakMap) so multiple chart
 * instances on the same page (e.g. 1h + 4h panels) don't trample each
 * other's tags.
 *
 * Lifecycle: cleared at the start of every full render (kline +
 * indicator pass). Persists across overlay-only render passes so tags
 * drawn during the previous full render still resolve when only the
 * overlay redraws.
 */

import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export interface BufferedPriceTag {
  priceText: string;
  y: number;
  fillColor: string;
  textColor?: string;
  width: number;
}

const buffers = new WeakMap<CanvasManager, BufferedPriceTag[]>();

const getBuffer = (manager: CanvasManager): BufferedPriceTag[] => {
  let b = buffers.get(manager);
  if (!b) {
    b = [];
    buffers.set(manager, b);
  }
  return b;
};

export const queuePriceTag = (manager: CanvasManager, tag: BufferedPriceTag): void => {
  getBuffer(manager).push(tag);
};

export const drainPriceTagBuffer = (manager: CanvasManager): BufferedPriceTag[] => {
  return getBuffer(manager).slice();
};

export const peekPriceTagBufferSize = (manager: CanvasManager): number => {
  return buffers.get(manager)?.length ?? 0;
};

export const clearPriceTagBuffer = (manager: CanvasManager): void => {
  const b = buffers.get(manager);
  if (b) b.length = 0;
};
