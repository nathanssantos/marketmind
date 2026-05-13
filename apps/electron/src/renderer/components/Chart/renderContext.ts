import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

import type {
  OrderCloseButton,
  OrderHitbox,
  PositionActionsButton,
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
  actionsButtons: PositionActionsButton[];
  orderHitboxes: OrderHitbox[];
  sltpHitboxes: SLTPHitbox[];
  sltpCloseButtons: SLTPCloseButton[];
  slTpButtonHitboxes: SlTpButtonHitbox[];
  tsCloseButtons: Array<{ x: number; y: number; size: number }>;
  needsAnimation: boolean;
  showProfitLossAreas: boolean;
  showBreakevenLines: boolean;
  breakevenTakerRate: number;
  /** Theme-aware base color for the BE line (typically `colors.text`). Alpha is applied at draw time. */
  breakevenLineColor: string;
  infoTagBg: string;
  infoTagText: string;
  currentPriceTag: { y: number; height: number } | null;
  stackPriceTags: boolean;
}
