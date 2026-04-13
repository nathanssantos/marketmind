import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

import type {
  OrderCloseButton,
  OrderHitbox,
  SLTPCloseButton,
  SLTPHitbox,
  SlTpButtonHitbox,
} from './orderLineTypes';

export interface PriceTagEntry {
  priceText: string;
  y: number;
  fillColor: string;
  flashAlpha?: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  manager: CanvasManager;
  chartWidth: number;
  chartHeight: number;
  klines: Array<{ openTime: number }>;
  currentPrice: number;
  now: number;
  isOrderLoading: (orderId: string) => boolean;
  getFlashAlpha: (orderId: string) => number;
  priceTags: PriceTagEntry[];
  closeButtons: OrderCloseButton[];
  orderHitboxes: OrderHitbox[];
  sltpHitboxes: SLTPHitbox[];
  sltpCloseButtons: SLTPCloseButton[];
  slTpButtonHitboxes: SlTpButtonHitbox[];
  tsCloseButtons: Array<{ x: number; y: number; size: number }>;
  needsAnimation: boolean;
  showProfitLossAreas: boolean;
}
