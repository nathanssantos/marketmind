import { describe, expect, it, vi } from 'vitest';
import { getPositionEventBus, type PositionClosedEvent } from '../../../services/scalping/position-event-bus';

describe('PositionEventBus', () => {
  it('should return singleton instance', () => {
    const bus1 = getPositionEventBus();
    const bus2 = getPositionEventBus();
    expect(bus1).toBe(bus2);
  });

  it('should emit and receive position:closed events', () => {
    const bus = getPositionEventBus();
    const handler = vi.fn();
    const unsub = bus.onPositionClosed(handler);

    const event: PositionClosedEvent = {
      walletId: 'wallet-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: 50,
      executionId: 'exec-1',
    };

    bus.emitPositionClosed(event);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);

    unsub();
  });

  it('should support multiple handlers', () => {
    const bus = getPositionEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = bus.onPositionClosed(handler1);
    const unsub2 = bus.onPositionClosed(handler2);

    const event: PositionClosedEvent = {
      walletId: 'wallet-1',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      pnl: -20,
      executionId: 'exec-2',
    };

    bus.emitPositionClosed(event);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it('should unsubscribe correctly', () => {
    const bus = getPositionEventBus();
    const handler = vi.fn();
    const unsub = bus.onPositionClosed(handler);

    unsub();

    bus.emitPositionClosed({
      walletId: 'wallet-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: 10,
      executionId: 'exec-3',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle LONG and SHORT sides', () => {
    const bus = getPositionEventBus();
    const handler = vi.fn();
    const unsub = bus.onPositionClosed(handler);

    bus.emitPositionClosed({
      walletId: 'w1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      pnl: 100,
      executionId: 'e1',
    });

    bus.emitPositionClosed({
      walletId: 'w1',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      pnl: -50,
      executionId: 'e2',
    });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]![0].side).toBe('LONG');
    expect(handler.mock.calls[1]![0].side).toBe('SHORT');

    unsub();
  });
});
