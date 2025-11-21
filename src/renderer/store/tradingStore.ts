import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Wallet,
  WalletPerformancePoint,
  Order,
  Position,
  OrderStatus,
  WalletCurrency,
  ExpirationType,
} from '@shared/types/trading';

interface TradingState {
  isSimulatorActive: boolean;
  wallets: Wallet[];
  activeWalletId: string | null;
  orders: Order[];
  defaultQuantity: number;
  defaultExpiration: ExpirationType;

  toggleSimulator: () => void;
  addWallet: (
    name: string,
    initialBalance: number,
    currency: WalletCurrency
  ) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  getActiveWallet: () => Wallet | null;
  updateWalletBalance: (walletId: string, amount: number) => void;
  recordWalletPerformance: (walletId: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  cancelOrder: (id: string) => void;
  closeOrder: (id: string, closePrice: number) => void;
  getPositions: (walletId?: string) => Position[];
  getPositionBySymbol: (symbol: string, walletId?: string) => Position | null;
  getOrdersBySymbol: (symbol: string) => Order[];
  getOrdersByWallet: (walletId: string) => Order[];
  getActiveOrders: () => Order[];
  setDefaultQuantity: (quantity: number) => void;
  setDefaultExpiration: (type: ExpirationType) => void;
  updatePrices: (symbol: string, price: number) => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set, get) => ({
      isSimulatorActive: false,
      wallets: [],
      activeWalletId: null,
      orders: [],
      defaultQuantity: 1,
      defaultExpiration: 'gtc',

      toggleSimulator: () =>
        set((state) => ({ isSimulatorActive: !state.isSimulatorActive })),

      addWallet: (name, initialBalance, currency) =>
        set((state) => {
          const newWallet: Wallet = {
            id: nanoid(),
            name,
            balance: initialBalance,
            initialBalance,
            currency,
            createdAt: new Date(),
            performance: [
              {
                timestamp: new Date(),
                balance: initialBalance,
                pnl: 0,
                pnlPercent: 0,
              },
            ],
          };
          const wallets = [...state.wallets, newWallet];
          return {
            wallets,
            activeWalletId: state.activeWalletId || newWallet.id,
          };
        }),

      updateWallet: (id, updates) =>
        set((state) => ({
          wallets: state.wallets.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),

      deleteWallet: (id) =>
        set((state) => {
          const wallets = state.wallets.filter((w) => w.id !== id);
          const orders = state.orders.filter((o) => o.walletId !== id);
          return {
            wallets,
            orders,
            activeWalletId:
              state.activeWalletId === id
                ? wallets[0]?.id || null
                : state.activeWalletId,
          };
        }),

      setActiveWallet: (id) => set({ activeWalletId: id }),

      getActiveWallet: () => {
        const state = get();
        return (
          state.wallets.find((w) => w.id === state.activeWalletId) || null
        );
      },

      updateWalletBalance: (walletId, amount) =>
        set((state) => ({
          wallets: state.wallets.map((w) =>
            w.id === walletId ? { ...w, balance: w.balance + amount } : w
          ),
        })),

      recordWalletPerformance: (walletId) =>
        set((state) => {
          const wallet = state.wallets.find((w) => w.id === walletId);
          if (!wallet) return state;

          const pnl = wallet.balance - wallet.initialBalance;
          const pnlPercent = (pnl / wallet.initialBalance) * 100;

          const newPerformance: WalletPerformancePoint = {
            timestamp: new Date(),
            balance: wallet.balance,
            pnl,
            pnlPercent,
          };

          return {
            wallets: state.wallets.map((w) =>
              w.id === walletId
                ? { ...w, performance: [...w.performance, newPerformance] }
                : w
            ),
          };
        }),

      addOrder: (orderData) =>
        set((state) => {
          const newOrder: Order = {
            ...orderData,
            id: nanoid(),
            createdAt: new Date(),
          };
          return { orders: [...state.orders, newOrder] };
        }),

      updateOrder: (id, updates) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),

      cancelOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'cancelled' as OrderStatus } : o
          ),
        })),

      closeOrder: (id, closePrice) =>
        set((state) => {
          const order = state.orders.find((o) => o.id === id);
          if (!order) return state;

          const pnl =
            (closePrice - order.entryPrice) *
            order.quantity *
            (order.type === 'long' ? 1 : -1);
          const pnlPercent = (pnl / (order.entryPrice * order.quantity)) * 100;

          const commission = order.commission || 0;
          const netPnl = pnl - commission;

          const wallet = state.wallets.find((w) => w.id === order.walletId);
          if (wallet) {
            const updatedWallets = state.wallets.map((w) =>
              w.id === order.walletId
                ? { ...w, balance: w.balance + netPnl }
                : w
            );

            return {
              orders: state.orders.map((o) =>
                o.id === id
                  ? {
                      ...o,
                      status: 'closed' as OrderStatus,
                      closedAt: new Date(),
                      pnl: netPnl,
                      pnlPercent,
                      currentPrice: closePrice,
                    }
                  : o
              ),
              wallets: updatedWallets,
            };
          }

          return {
            orders: state.orders.map((o) =>
              o.id === id
                ? {
                    ...o,
                    status: 'closed' as OrderStatus,
                    closedAt: new Date(),
                    pnl: netPnl,
                    pnlPercent,
                    currentPrice: closePrice,
                  }
                : o
            ),
          };
        }),

      getPositions: (walletId) => {
        const state = get();
        const targetWalletId = walletId || state.activeWalletId;
        if (!targetWalletId) return [];

        const activeOrders = state.orders.filter(
          (o) => o.walletId === targetWalletId && o.status === 'active'
        );

        const positionMap = new Map<string, Position>();

        activeOrders.forEach((order) => {
          const existing = positionMap.get(order.symbol);
          if (existing) {
            const totalQuantity = existing.quantity + order.quantity;
            const avgPrice =
              (existing.avgPrice * existing.quantity +
                order.entryPrice * order.quantity) /
              totalQuantity;
            const currentPrice = order.currentPrice || order.entryPrice;
            const pnl = (currentPrice - avgPrice) * totalQuantity;
            const pnlPercent = (pnl / (avgPrice * totalQuantity)) * 100;

            positionMap.set(order.symbol, {
              symbol: order.symbol,
              quantity: totalQuantity,
              avgPrice,
              currentPrice,
              pnl,
              pnlPercent,
              orders: [...existing.orders, order.id],
            });
          } else {
            const currentPrice = order.currentPrice || order.entryPrice;
            const pnl = (currentPrice - order.entryPrice) * order.quantity;
            const pnlPercent = (pnl / (order.entryPrice * order.quantity)) * 100;

            positionMap.set(order.symbol, {
              symbol: order.symbol,
              quantity: order.quantity,
              avgPrice: order.entryPrice,
              currentPrice,
              pnl,
              pnlPercent,
              orders: [order.id],
            });
          }
        });

        return Array.from(positionMap.values());
      },

      getPositionBySymbol: (symbol, walletId) => {
        const positions = get().getPositions(walletId);
        return positions.find((p) => p.symbol === symbol) || null;
      },

      getOrdersBySymbol: (symbol) => {
        const state = get();
        return state.orders.filter((o) => o.symbol === symbol);
      },

      getOrdersByWallet: (walletId) => {
        const state = get();
        return state.orders.filter((o) => o.walletId === walletId);
      },

      getActiveOrders: () => {
        const state = get();
        return state.orders.filter(
          (o) => o.status === 'active' || o.status === 'pending'
        );
      },

      setDefaultQuantity: (quantity) => set({ defaultQuantity: quantity }),

      setDefaultExpiration: (type) => set({ defaultExpiration: type }),

      updatePrices: (symbol, price) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.symbol === symbol && (o.status === 'active' || o.status === 'pending')
              ? { ...o, currentPrice: price }
              : o
          ),
        })),
    }),
    {
      name: 'trading-storage',
    }
  )
);
