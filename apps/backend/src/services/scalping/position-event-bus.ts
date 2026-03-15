import { EventEmitter } from 'events';

export interface PositionClosedEvent {
  walletId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  pnl: number;
  executionId: string;
}

class PositionEventBus extends EventEmitter {
  emitPositionClosed(event: PositionClosedEvent): void {
    this.emit('position:closed', event);
  }

  onPositionClosed(handler: (event: PositionClosedEvent) => void): () => void {
    this.on('position:closed', handler);
    return () => this.off('position:closed', handler);
  }
}

let instance: PositionEventBus | null = null;

export const getPositionEventBus = (): PositionEventBus => {
  if (!instance) instance = new PositionEventBus();
  return instance;
};
