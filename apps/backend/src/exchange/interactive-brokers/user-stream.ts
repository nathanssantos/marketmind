import type { Contract, OpenOrder, Position } from '@stoqey/ib';
import { Subscription } from 'rxjs';
import type { ExchangeId } from '../types';
import { IBConnectionManager, getDefaultConnectionManager } from './connection-manager';
import type { IBPosition, IBOrderResult, IBExecution } from './types';

export interface UserStreamUpdate {
  type: 'ORDER' | 'POSITION' | 'EXECUTION';
  data: IBOrderResult | IBPosition | IBExecution;
  timestamp: number;
}

type UserStreamHandler = (update: UserStreamUpdate) => void;

interface OrderInfo {
  orderId: number;
  contract: Contract;
  status: string;
  filled: number;
  remaining: number;
  avgFillPrice: number;
  lastUpdate: number;
}

interface PositionInfo {
  account: string;
  contract: Contract;
  position: number;
  avgCost: number;
  marketValue: number;
  unrealizedPnL: number;
  lastUpdate: number;
}

export class IBUserStream {
  readonly exchangeId: ExchangeId = 'INTERACTIVE_BROKERS';
  private connectionManager: IBConnectionManager;
  private handlers: Set<UserStreamHandler> = new Set();
  private isRunning = false;
  private orderSubscription: Subscription | null = null;
  private positionSubscription: Subscription | null = null;
  private orders: Map<number, OrderInfo> = new Map();
  private positions: Map<string, PositionInfo> = new Map();

  constructor(connectionManager?: IBConnectionManager) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    this.subscribeToOrders();
    this.subscribeToPositions();
    this.isRunning = true;
  }

  stop(): void {
    if (!this.isRunning) return;

    this.orderSubscription?.unsubscribe();
    this.positionSubscription?.unsubscribe();
    this.orderSubscription = null;
    this.positionSubscription = null;
    this.isRunning = false;
  }

  private subscribeToOrders(): void {
    const observable = this.connectionManager.client.getOpenOrders();

    this.orderSubscription = observable.subscribe({
      next: (ordersUpdate) => {
        const orders = ordersUpdate.all ?? [];
        this.processOrdersUpdate(orders);
      },
      error: (err) => {
        console.error('[IBUserStream] Orders subscription error:', err);
      },
    });
  }

  private subscribeToPositions(): void {
    const observable = this.connectionManager.client.getPositions();

    this.positionSubscription = observable.subscribe({
      next: (positionsUpdate) => {
        const positions = positionsUpdate.all;
        this.processPositionsUpdate(positions);
      },
      error: (err) => {
        console.error('[IBUserStream] Positions subscription error:', err);
      },
    });
  }

  private processOrdersUpdate(orders: OpenOrder[]): void {
    for (const order of orders) {
      const orderId = order.orderId;
      const existing = this.orders.get(orderId);

      const orderInfo: OrderInfo = {
        orderId,
        contract: order.contract,
        status: order.orderState?.status ?? 'Unknown',
        filled: order.order?.filledQuantity ?? 0,
        remaining: order.order?.totalQuantity ?? 0,
        avgFillPrice: 0,
        lastUpdate: Date.now(),
      };

      const hasChanged =
        !existing ||
        existing.status !== orderInfo.status ||
        existing.filled !== orderInfo.filled;

      if (hasChanged) {
        this.orders.set(orderId, orderInfo);

        const update: UserStreamUpdate = {
          type: 'ORDER',
          data: this.mapToIBOrderResult(order),
          timestamp: Date.now(),
        };

        this.notifyHandlers(update);
      }
    }
  }

  private processPositionsUpdate(positions: ReadonlyMap<string, Position[]>): void {
    for (const [accountId, accountPositions] of positions) {
      for (const pos of accountPositions) {
        const key = `${accountId}:${pos.contract.symbol}`;
        const existing = this.positions.get(key);

        const positionInfo: PositionInfo = {
          account: accountId,
          contract: pos.contract,
          position: pos.pos,
          avgCost: pos.avgCost ?? 0,
          marketValue: pos.marketValue ?? 0,
          unrealizedPnL: pos.unrealizedPNL ?? 0,
          lastUpdate: Date.now(),
        };

        const hasChanged =
          !existing ||
          existing.position !== positionInfo.position ||
          existing.avgCost !== positionInfo.avgCost;

        if (hasChanged) {
          this.positions.set(key, positionInfo);

          const update: UserStreamUpdate = {
            type: 'POSITION',
            data: this.mapToIBPosition(pos),
            timestamp: Date.now(),
          };

          this.notifyHandlers(update);
        }
      }
    }
  }

  private mapToIBOrderResult(order: OpenOrder): IBOrderResult {
    return {
      orderId: order.orderId,
      clientId: order.order?.clientId ?? 0,
      permId: order.order?.permId ?? 0,
      contract: order.contract,
      order: order.order!,
      orderState: order.orderState!,
      status: order.orderState?.status ?? 'Unknown',
      filled: order.order?.filledQuantity ?? 0,
      remaining: order.order?.totalQuantity ?? 0,
      avgFillPrice: 0,
      lastFillPrice: 0,
      whyHeld: order.orderState?.warningText,
    };
  }

  private mapToIBPosition(pos: Position): IBPosition {
    return {
      account: pos.account,
      contract: pos.contract,
      position: pos.pos,
      avgCost: pos.avgCost ?? 0,
      marketValue: pos.marketValue,
      unrealizedPnL: pos.unrealizedPNL,
      realizedPnL: pos.realizedPNL,
    };
  }

  onUpdate(handler: UserStreamHandler): void {
    this.handlers.add(handler);
  }

  removeHandler(handler: UserStreamHandler): void {
    this.handlers.delete(handler);
  }

  private notifyHandlers(update: UserStreamUpdate): void {
    for (const handler of this.handlers) {
      try {
        handler(update);
      } catch (error) {
        console.error('[IBUserStream] Handler error:', error);
      }
    }
  }

  getOrder(orderId: number): OrderInfo | undefined {
    return this.orders.get(orderId);
  }

  getAllOrders(): OrderInfo[] {
    return Array.from(this.orders.values());
  }

  getOpenOrders(): OrderInfo[] {
    const openStatuses = ['PreSubmitted', 'Submitted', 'PendingSubmit', 'PendingCancel'];
    return Array.from(this.orders.values()).filter((o) =>
      openStatuses.includes(o.status)
    );
  }

  getPosition(accountId: string, symbol: string): PositionInfo | undefined {
    return this.positions.get(`${accountId}:${symbol}`);
  }

  getAllPositions(): PositionInfo[] {
    return Array.from(this.positions.values());
  }

  getNonZeroPositions(): PositionInfo[] {
    return Array.from(this.positions.values()).filter((p) => p.position !== 0);
  }

  getPositionsForAccount(accountId: string): PositionInfo[] {
    return Array.from(this.positions.values()).filter((p) => p.account === accountId);
  }

  isStreaming(): boolean {
    return this.isRunning;
  }

  clearCache(): void {
    this.orders.clear();
    this.positions.clear();
  }
}

export const userStream = new IBUserStream();
