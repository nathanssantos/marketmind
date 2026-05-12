import type { Order } from '@marketmind/types';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { OrderCloseButton, OrderHitbox, PositionActionsButton, SLTPHitbox, SLTPCloseButton, SlTpButtonHitbox } from './orderLineTypes';
import type { RefObject } from 'react';

export const getClickedOrderId = (
  x: number,
  y: number,
  tsCloseButtons: Array<{ x: number; y: number; size: number }>,
  sltpCloseButtons: SLTPCloseButton[],
  closeButtons: OrderCloseButton[]
): string | null => {
  for (const btn of tsCloseButtons) {
    if (x >= btn.x && x <= btn.x + btn.size && y >= btn.y && y <= btn.y + btn.size) return 'ts-disable';
  }

  for (const button of sltpCloseButtons) {
    if (
      x >= button.x &&
      x <= button.x + button.width &&
      y >= button.y &&
      y <= button.y + button.height
    ) {
      return `sltp:${button.type}:${button.orderIds.join(',')}`;
    }
  }

  for (const button of closeButtons) {
    if (
      x >= button.x &&
      x <= button.x + button.width &&
      y >= button.y &&
      y <= button.y + button.height
    ) {
      return button.orderId;
    }
  }
  return null;
};

export const getOrderAtPosition = (
  x: number,
  y: number,
  manager: CanvasManager | null,
  hasTradingEnabled: boolean,
  orderHitboxes: OrderHitbox[]
): Order | null => {
  if (!manager || !hasTradingEnabled) return null;

  for (const hitbox of orderHitboxes) {
    if (
      x >= hitbox.x &&
      x <= hitbox.x + hitbox.width &&
      y >= hitbox.y &&
      y <= hitbox.y + hitbox.height
    ) {
      return hitbox.order;
    }
  }

  return null;
};

export const getHoveredOrder = (
  x: number,
  y: number,
  orderHitboxes: OrderHitbox[]
): Order | null => {
  for (const hitbox of orderHitboxes) {
    if (
      x >= hitbox.x &&
      x <= hitbox.x + hitbox.width &&
      y >= hitbox.y &&
      y <= hitbox.y + hitbox.height
    ) {
      return hitbox.order;
    }
  }

  return null;
};

export const getSLTPAtPosition = (
  x: number,
  y: number,
  sltpHitboxes: SLTPHitbox[]
): { orderId: string; type: 'stopLoss' | 'takeProfit'; price: number } | null => {
  for (const hitbox of sltpHitboxes) {
    if (
      x >= hitbox.x &&
      x <= hitbox.x + hitbox.width &&
      y >= hitbox.y &&
      y <= hitbox.y + hitbox.height
    ) {
      return {
        orderId: hitbox.orderId,
        type: hitbox.type,
        price: hitbox.price,
      };
    }
  }
  return null;
};

export interface ClickedPositionActions {
  positionId: string;
  rect: { x: number; y: number; width: number; height: number };
}

export const getClickedPositionActions = (
  x: number,
  y: number,
  actionsButtons: PositionActionsButton[]
): ClickedPositionActions | null => {
  for (const button of actionsButtons) {
    if (
      x >= button.x &&
      x <= button.x + button.width &&
      y >= button.y &&
      y <= button.y + button.height
    ) {
      return {
        positionId: button.positionId,
        rect: { x: button.x, y: button.y, width: button.width, height: button.height },
      };
    }
  }
  return null;
};

export const getSlTpButtonAtPosition = (
  x: number,
  y: number,
  slTpButtonHitboxes: SlTpButtonHitbox[]
): { executionId: string; type: 'stopLoss' | 'takeProfit' } | null => {
  for (const hitbox of slTpButtonHitboxes) {
    if (
      x >= hitbox.x &&
      x <= hitbox.x + hitbox.width &&
      y >= hitbox.y &&
      y <= hitbox.y + hitbox.height
    ) {
      return { executionId: hitbox.executionId, type: hitbox.type };
    }
  }
  return null;
};

export interface HitTestRefs {
  closeButtonsRef: RefObject<OrderCloseButton[]>;
  actionsButtonsRef: RefObject<PositionActionsButton[]>;
  orderHitboxesRef: RefObject<OrderHitbox[]>;
  sltpHitboxesRef: RefObject<SLTPHitbox[]>;
  sltpCloseButtonsRef: RefObject<SLTPCloseButton[]>;
  slTpButtonHitboxesRef: RefObject<SlTpButtonHitbox[]>;
  tsCloseButtonsRef: RefObject<Array<{ x: number; y: number; size: number }>>;
}
