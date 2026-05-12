import type { Order } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  getClickedOrderId,
  getClickedPositionActions,
  getOrderAtPosition,
  getHoveredOrder,
  getSLTPAtPosition,
  getSlTpButtonAtPosition,
} from '../orderLineHitTest';
import type { OrderCloseButton, OrderHitbox, PositionActionsButton, SLTPCloseButton, SLTPHitbox, SlTpButtonHitbox } from '../orderLineTypes';

const makeOrder = (id: string): Order =>
  ({
    id,
    symbol: 'BTCUSDT',
    side: 'BUY',
    price: '50000',
    status: 'FILLED',
  }) as unknown as Order;

describe('getClickedOrderId', () => {
  const tsCloseButtons = [{ x: 10, y: 10, size: 20 }];
  const sltpCloseButtons: SLTPCloseButton[] = [
    { orderIds: ['sl1', 'sl2'], x: 50, y: 50, width: 30, height: 20, type: 'stopLoss' },
  ];
  const closeButtons: OrderCloseButton[] = [
    { orderId: 'order-1', x: 100, y: 100, width: 30, height: 20 },
  ];

  it('returns ts-disable when clicking a trailing stop close button', () => {
    expect(getClickedOrderId(15, 15, tsCloseButtons, [], [])).toBe('ts-disable');
  });

  it('returns ts-disable at the button boundary', () => {
    expect(getClickedOrderId(10, 10, tsCloseButtons, [], [])).toBe('ts-disable');
    expect(getClickedOrderId(30, 30, tsCloseButtons, [], [])).toBe('ts-disable');
  });

  it('returns null when outside trailing stop button', () => {
    expect(getClickedOrderId(31, 31, tsCloseButtons, [], [])).toBeNull();
  });

  it('returns sltp identifier when clicking an SLTP close button', () => {
    const result = getClickedOrderId(55, 55, [], sltpCloseButtons, []);
    expect(result).toBe('sltp:stopLoss:sl1,sl2');
  });

  it('returns orderId when clicking an order close button', () => {
    expect(getClickedOrderId(110, 110, [], [], closeButtons)).toBe('order-1');
  });

  it('returns null when clicking empty space', () => {
    expect(getClickedOrderId(200, 200, tsCloseButtons, sltpCloseButtons, closeButtons)).toBeNull();
  });

  it('prioritizes ts close button over sltp and order buttons', () => {
    const overlapping: SLTPCloseButton[] = [
      { orderIds: ['o1'], x: 10, y: 10, width: 20, height: 20, type: 'takeProfit' },
    ];
    expect(getClickedOrderId(15, 15, tsCloseButtons, overlapping, [])).toBe('ts-disable');
  });
});

describe('getOrderAtPosition', () => {
  const order = makeOrder('order-1');
  const hitboxes: OrderHitbox[] = [
    { orderId: 'order-1', x: 0, y: 0, width: 100, height: 20, order },
  ];

  it('returns null when manager is null', () => {
    expect(getOrderAtPosition(50, 10, null, true, hitboxes)).toBeNull();
  });

  it('returns null when trading is disabled', () => {
    const manager = {} as never;
    expect(getOrderAtPosition(50, 10, manager, false, hitboxes)).toBeNull();
  });

  it('returns order when click is inside hitbox', () => {
    const manager = {} as never;
    expect(getOrderAtPosition(50, 10, manager, true, hitboxes)).toBe(order);
  });

  it('returns null when click is outside all hitboxes', () => {
    const manager = {} as never;
    expect(getOrderAtPosition(200, 200, manager, true, hitboxes)).toBeNull();
  });

  it('returns order at exact boundary', () => {
    const manager = {} as never;
    expect(getOrderAtPosition(0, 0, manager, true, hitboxes)).toBe(order);
    expect(getOrderAtPosition(100, 20, manager, true, hitboxes)).toBe(order);
  });
});

describe('getHoveredOrder', () => {
  const order1 = makeOrder('o1');
  const order2 = makeOrder('o2');
  const hitboxes: OrderHitbox[] = [
    { orderId: 'o1', x: 0, y: 0, width: 50, height: 20, order: order1 },
    { orderId: 'o2', x: 60, y: 0, width: 50, height: 20, order: order2 },
  ];

  it('returns first matching order', () => {
    expect(getHoveredOrder(25, 10, hitboxes)).toBe(order1);
  });

  it('returns second order when hovering over it', () => {
    expect(getHoveredOrder(70, 10, hitboxes)).toBe(order2);
  });

  it('returns null when no hitbox matches', () => {
    expect(getHoveredOrder(55, 10, hitboxes)).toBeNull();
  });

  it('returns null for empty hitboxes', () => {
    expect(getHoveredOrder(10, 10, [])).toBeNull();
  });
});

describe('getSLTPAtPosition', () => {
  const hitboxes: SLTPHitbox[] = [
    { orderId: 'sl-1', x: 10, y: 10, width: 40, height: 15, type: 'stopLoss', price: 48000 },
    { orderId: 'tp-1', x: 10, y: 30, width: 40, height: 15, type: 'takeProfit', price: 55000 },
  ];

  it('returns stop loss info when hovering the SL hitbox', () => {
    const result = getSLTPAtPosition(20, 15, hitboxes);
    expect(result).toEqual({ orderId: 'sl-1', type: 'stopLoss', price: 48000 });
  });

  it('returns take profit info when hovering the TP hitbox', () => {
    const result = getSLTPAtPosition(20, 35, hitboxes);
    expect(result).toEqual({ orderId: 'tp-1', type: 'takeProfit', price: 55000 });
  });

  it('returns null when outside all hitboxes', () => {
    expect(getSLTPAtPosition(100, 100, hitboxes)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getSLTPAtPosition(20, 15, [])).toBeNull();
  });
});

describe('getClickedPositionActions', () => {
  const actionsButtons: PositionActionsButton[] = [
    { positionId: 'pos-1', x: 5, y: 100, width: 14, height: 14 },
    { positionId: 'pos-2', x: 5, y: 200, width: 14, height: 14 },
  ];

  it('returns positionId + rect when clicking inside a button', () => {
    const result = getClickedPositionActions(10, 105, actionsButtons);
    expect(result).toEqual({
      positionId: 'pos-1',
      rect: { x: 5, y: 100, width: 14, height: 14 },
    });
  });

  it('returns the matching position for the second button', () => {
    const result = getClickedPositionActions(10, 205, actionsButtons);
    expect(result).not.toBeNull();
    expect(result?.positionId).toBe('pos-2');
  });

  it('returns null when outside all buttons', () => {
    expect(getClickedPositionActions(50, 50, actionsButtons)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getClickedPositionActions(10, 105, [])).toBeNull();
  });

  it('returns the position at exact boundary', () => {
    expect(getClickedPositionActions(5, 100, actionsButtons)).not.toBeNull();
    expect(getClickedPositionActions(19, 114, actionsButtons)).not.toBeNull();
  });
});

describe('getClickedOrderId — position regression', () => {
  it('does NOT match position close buttons (positions moved to actionsButtons)', () => {
    // Regression for the kebab refactor: when the kebab replaces the X on
    // positions, the position id must NOT come back from getClickedOrderId
    // anymore — only order ids do.
    expect(getClickedOrderId(10, 105, [], [], [])).toBeNull();
  });
});

describe('getSlTpButtonAtPosition', () => {
  const hitboxes: SlTpButtonHitbox[] = [
    { executionId: 'exec-1', type: 'stopLoss', x: 0, y: 0, width: 20, height: 14 },
    { executionId: 'exec-1', type: 'takeProfit', x: 25, y: 0, width: 20, height: 14 },
  ];

  it('returns SL button info when clicked', () => {
    const result = getSlTpButtonAtPosition(10, 7, hitboxes);
    expect(result).toEqual({ executionId: 'exec-1', type: 'stopLoss' });
  });

  it('returns TP button info when clicked', () => {
    const result = getSlTpButtonAtPosition(30, 7, hitboxes);
    expect(result).toEqual({ executionId: 'exec-1', type: 'takeProfit' });
  });

  it('returns null when between buttons', () => {
    expect(getSlTpButtonAtPosition(22, 7, hitboxes)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getSlTpButtonAtPosition(10, 7, [])).toBeNull();
  });
});
