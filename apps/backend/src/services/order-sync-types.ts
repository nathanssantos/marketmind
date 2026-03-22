export interface OrphanOrder {
  algoId: string;
  symbol: string;
  type: string;
  side: string;
  triggerPrice: string;
  quantity: string;
  hasPositionOnExchange: boolean;
}

export interface MismatchedOrder {
  executionId: string;
  symbol: string;
  field: 'stopLoss' | 'takeProfit';
  dbValue: number | null;
  dbAlgoId: string | null;
  exchangeAlgoId: string | null;
  exchangeTriggerPrice: string | null;
}

export interface FixedOrder {
  executionId: string;
  symbol: string;
  field: 'stopLoss' | 'takeProfit';
  oldAlgoId: string | null;
  newAlgoId: string;
  newTriggerPrice: string;
}

export interface OrderSyncResult {
  walletId: string;
  synced: boolean;
  orphanOrders: OrphanOrder[];
  mismatchedOrders: MismatchedOrder[];
  fixedOrders: FixedOrder[];
  cancelledOrphans: number;
  errors: string[];
}

export interface OrderSyncServiceStartOptions {
  autoCancelOrphans?: boolean;
  autoFixMismatches?: boolean;
  delayFirstSync?: number;
}

export const createEmptyOrderSyncResult = (walletId: string): OrderSyncResult => ({
  walletId,
  synced: true,
  orphanOrders: [],
  mismatchedOrders: [],
  fixedOrders: [],
  cancelledOrphans: 0,
  errors: [],
});
