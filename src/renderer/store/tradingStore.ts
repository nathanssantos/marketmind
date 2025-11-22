import type {
    ExpirationType,
    Order,
    OrderStatus,
    Position,
    Wallet,
    WalletCurrency,
    WalletPerformancePoint,
} from '@shared/types/trading';
import { nanoid } from 'nanoid';
import { create } from 'zustand';

interface TradingState {
  isSimulatorActive: boolean;
  wallets: Wallet[];
  activeWalletId: string | null;
  orders: Order[];
  defaultQuantity: number;
  defaultExpiration: ExpirationType;

  toggleSimulator: () => void;
  addWallet: (params: {
    name: string;
    initialBalance: number;
    currency: WalletCurrency;
  }) => void;
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
  fillPendingOrders: (symbol: string, currentPrice: number, previousPrice: number | null, appLoadTime: number) => void;
  activateOrder: (id: string, executionPrice: number) => void;
  expireOrders: () => void;
  clearAllData: () => void;
  syncWithElectron: () => Promise<void>;
  saveToElectron: () => Promise<void>;
}

const loadFromElectron = async (): Promise<Partial<TradingState>> => {
  try {
    const result = await window.electron.secureStorage.getTradingData();
    if (result.success && result.data) {
      const wallets = result.data.wallets.map((wallet) => ({
        ...wallet,
        createdAt: new Date(wallet.createdAt),
        performance: wallet.performance.map((p) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        })),
      }));

      const orders = result.data.orders.map((order) => {
        const baseOrder = {
          ...order,
          createdAt: new Date(order.createdAt),
        };
        
        if (order.filledAt) baseOrder.filledAt = new Date(order.filledAt);
        if (order.closedAt) baseOrder.closedAt = new Date(order.closedAt);
        if (order.expirationDate) baseOrder.expirationDate = new Date(order.expirationDate);
        
        return baseOrder;
      });

      return {
        wallets,
        orders,
        isSimulatorActive: result.data.isSimulatorActive,
        activeWalletId: result.data.activeWalletId,
        defaultQuantity: result.data.defaultQuantity,
        defaultExpiration: result.data.defaultExpiration,
      };
    }
  } catch (error) {
    console.error('Failed to load trading data from Electron:', error);
  }
  return {};
};

const saveToElectron = async (state: TradingState): Promise<void> => {
  try {
    await window.electron.secureStorage.setTradingData({
      wallets: state.wallets,
      orders: state.orders,
      isSimulatorActive: state.isSimulatorActive,
      activeWalletId: state.activeWalletId,
      defaultQuantity: state.defaultQuantity,
      defaultExpiration: state.defaultExpiration as 'gtc' | 'day' | 'custom',
    });
  } catch (error) {
    console.error('Failed to save trading data to Electron:', error);
  }
};

export const useTradingStore = create<TradingState>((set, get) => {
  const setWithSync = (
    partial: Partial<TradingState> | ((state: TradingState) => Partial<TradingState>)
  ): void => {
    set(partial);
    saveToElectron(get());
  };

  return {
    isSimulatorActive: false,
    wallets: [],
    activeWalletId: null,
    orders: [],
    defaultQuantity: 1,
    defaultExpiration: 'gtc',

    toggleSimulator: () =>
      setWithSync((state) => ({ isSimulatorActive: !state.isSimulatorActive })),

      addWallet: ({ name, initialBalance, currency }) =>
        setWithSync((state) => {
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
        setWithSync((state) => ({
          wallets: state.wallets.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),

      deleteWallet: (id) =>
        setWithSync((state) => {
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

      setActiveWallet: (id) => setWithSync({ activeWalletId: id }),

      getActiveWallet: () => {
        const state = get();
        return (
          state.wallets.find((w) => w.id === state.activeWalletId) || null
        );
      },

      updateWalletBalance: (walletId, amount) =>
        setWithSync((state) => ({
          wallets: state.wallets.map((w) =>
            w.id === walletId ? { ...w, balance: w.balance + amount } : w
          ),
        })),

      recordWalletPerformance: (walletId) =>
        setWithSync((state) => {
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
        setWithSync((state) => {
          const newOrder: Order = {
            ...orderData,
            id: nanoid(),
            createdAt: new Date(),
          };
          return { orders: [...state.orders, newOrder] };
        }),

      updateOrder: (id, updates) =>
        setWithSync((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),

      cancelOrder: (id) =>
        setWithSync((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'cancelled' as OrderStatus } : o
          ),
        })),

      closeOrder: (id, closePrice) =>
        setWithSync((state) => {
          const order = state.orders.find((o) => o.id === id);
          if (!order) return state;

          const isActive = order.status === 'active';
          
          const relatedOrders = isActive ? state.orders.filter(
            (o) =>
              o.walletId === order.walletId &&
              o.symbol === order.symbol &&
              o.type === order.type &&
              o.status === 'active'
          ) : [order];

          let totalPnl = 0;
          let totalInvestment = 0;

          if (isActive) {
            relatedOrders.forEach((o) => {
              const orderPnl =
                (closePrice - o.entryPrice) *
                o.quantity *
                (o.type === 'long' ? 1 : -1);
              totalPnl += orderPnl;
              totalInvestment += o.entryPrice * o.quantity;
            });
          }

          const totalCommission = relatedOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
          const netPnl = isActive ? totalPnl - totalCommission : 0;

          const wallet = state.wallets.find((w) => w.id === order.walletId);
          const relatedOrderIds = new Set(relatedOrders.map((o) => o.id));

          if (wallet) {
            const updatedWallets = state.wallets.map((w) =>
              w.id === order.walletId
                ? { ...w, balance: w.balance + totalInvestment + netPnl }
                : w
            );

            return {
              orders: state.orders.map((o) => {
                if (relatedOrderIds.has(o.id)) {
                  const orderPnl = isActive
                    ? (closePrice - o.entryPrice) *
                      o.quantity *
                      (o.type === 'long' ? 1 : -1)
                    : 0;
                  const orderPnlPercent = isActive
                    ? (orderPnl / (o.entryPrice * o.quantity)) * 100
                    : 0;

                  return {
                    ...o,
                    status: 'closed' as OrderStatus,
                    closedAt: new Date(),
                    pnl: orderPnl,
                    pnlPercent: orderPnlPercent,
                    currentPrice: closePrice,
                  };
                }
                return o;
              }),
              wallets: updatedWallets,
            };
          }

          return {
            orders: state.orders.map((o) => {
              if (relatedOrderIds.has(o.id)) {
                const orderPnl = isActive
                  ? (closePrice - o.entryPrice) *
                    o.quantity *
                    (o.type === 'long' ? 1 : -1)
                  : 0;
                const orderPnlPercent = isActive
                  ? (orderPnl / (o.entryPrice * o.quantity)) * 100
                  : 0;

                return {
                  ...o,
                  status: 'closed' as OrderStatus,
                  closedAt: new Date(),
                  pnl: orderPnl,
                  pnlPercent: orderPnlPercent,
                  currentPrice: closePrice,
                };
              }
              return o;
            }),
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

      setDefaultQuantity: (quantity) => setWithSync({ defaultQuantity: quantity }),

      setDefaultExpiration: (type) => setWithSync({ defaultExpiration: type }),

      fillPendingOrders: (symbol, currentPrice, previousPrice, appLoadTime) =>
        setWithSync((state) => {
          const now = Date.now();
          let hasChanges = false;
          
          const pendingOrders = state.orders.filter((o) => o.symbol === symbol && o.status === 'pending');
          
          if (pendingOrders.length > 0) {
            const prevPriceStr = previousPrice !== null ? previousPrice.toFixed(2) : 'N/A';
            console.log(`[Trading] Checking ${pendingOrders.length} pending orders for ${symbol}`);
            console.log(`[Trading] Price: current=${currentPrice.toFixed(2)}, previous=${prevPriceStr}`);
          }
          
          const updatedOrders = state.orders.map((order) => {
            if (order.symbol !== symbol || order.status !== 'pending') return order;
            
            const orderTime = order.createdAt.getTime();
            if (orderTime > now) {
              console.log(`[Trading] Order ${order.id} skipped: created in future`);
              return order;
            }

            if (orderTime < appLoadTime) {
              if (pendingOrders.length > 0) {
                console.log(`[Trading] Order ${order.id} skipped: created before app loaded (${new Date(orderTime).toISOString()} < ${new Date(appLoadTime).toISOString()})`);
              }
              return order;
            }

            if (previousPrice === null) {
              console.log(`[Trading] Order ${order.id} skipped: no previous price yet`);
              return order;
            }

            const entryPrice = order.entryPrice;
            
            const min = Math.min(previousPrice, currentPrice);
            const max = Math.max(previousPrice, currentPrice);
            const priceMovedThroughEntry = min <= entryPrice && entryPrice <= max && previousPrice !== currentPrice;
            
            const filled = priceMovedThroughEntry;
            
            if (pendingOrders.length > 0) {
              console.log(`[Trading] Order ${order.id} (${order.type} ${order.subType} @ ${entryPrice.toFixed(2)}): range=[${min.toFixed(2)}, ${max.toFixed(2)}], touched=${priceMovedThroughEntry}, filled=${filled}`);
            }

            if (filled) {
              hasChanges = true;
              const direction = previousPrice < currentPrice ? 'up' : 'down';
              console.log(`[Trading] ✓ Order filled: ${order.type} ${order.subType} at ${entryPrice.toFixed(2)}, price moved ${direction} through entry (${previousPrice.toFixed(2)} → ${currentPrice.toFixed(2)})`);
              return {
                ...order,
                status: 'active' as OrderStatus,
                filledAt: new Date(),
                currentPrice,
              };
            }

            return order;
          });

          return hasChanges ? { orders: [...updatedOrders] } : state;
        }),

      activateOrder: (id, executionPrice) =>
        setWithSync((state) => {
          const order = state.orders.find((o) => o.id === id);
          if (!order || order.status !== 'pending') return state;

          const wallet = state.wallets.find((w) => w.id === order.walletId);
          if (!wallet) return state;

          const updatedOrders = state.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'active' as OrderStatus,
                  entryPrice: executionPrice,
                  currentPrice: executionPrice,
                  filledAt: new Date(),
                }
              : o
          );

          return { orders: updatedOrders };
        }),

      expireOrders: () =>
        setWithSync((state) => {
          const now = new Date();
          const updatedOrders = state.orders.map((order) => {
            if (
              order.status === 'pending' &&
              order.expirationDate &&
              order.expirationDate < now
            ) {
              return { ...order, status: 'expired' as OrderStatus };
            }
            return order;
          });

          return { orders: updatedOrders };
        }),

      updatePrices: (symbol, price) =>
        setWithSync((state) => ({
          orders: state.orders.map((o) =>
            o.symbol === symbol && (o.status === 'active' || o.status === 'pending')
              ? { ...o, currentPrice: price }
              : o
          ),
        })),

      clearAllData: () => {
        const newState = {
          wallets: [],
          activeWalletId: null,
          orders: [],
          defaultQuantity: 1,
          defaultExpiration: 'gtc' as ExpirationType,
        };
        setWithSync(newState);
      },

    syncWithElectron: async () => {
      const data = await loadFromElectron();
      set(data);
    },

    saveToElectron: async () => {
      await saveToElectron(get());
    },
  };
});
