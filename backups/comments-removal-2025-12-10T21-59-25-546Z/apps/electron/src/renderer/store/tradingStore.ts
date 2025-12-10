import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { TradingFees } from '@marketmind/types';
import { BINANCE_DEFAULT_FEES } from '@marketmind/types';
import type {
  ExpirationType,
  Order,
  OrderSide,
  OrderStatus,
  Position,
  Wallet,
  WalletCurrency,
  WalletPerformancePoint,
} from '@marketmind/types';
import { getOrderId, getOrderPrice, getOrderQuantity, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import { nanoid } from 'nanoid';
import { create } from 'zustand';

type OrderCreateInput = Partial<Omit<Order, 'id' | 'createdAt'>> & {
  symbol: string;
  walletId: string;
  side?: OrderSide;
  status?: OrderStatus;
  entryPrice?: number;
  quantity?: number;
  currentPrice?: number;
};

interface TradingState {
  isSimulatorActive: boolean;
  wallets: Wallet[];
  activeWalletId: string | null;
  orders: Order[];
  defaultQuantity: number;
  quantityBySymbol: Record<string, number>;
  defaultExpiration: ExpirationType;
  tradingFees: TradingFees;

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
  addOrder: (order: OrderCreateInput) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  cancelOrder: (id: string) => void;
  closeOrder: (id: string, closePrice: number) => void;
  getPositions: (walletId?: string) => Position[];
  getPositionBySymbol: (symbol: string, walletId?: string) => Position | null;
  getOrdersBySymbol: (symbol: string) => Order[];
  getOrdersByWallet: (walletId: string) => Order[];
  getActiveOrders: () => Order[];
  setDefaultQuantity: (quantity: number) => void;
  getQuantityForSymbol: (symbol: string) => number;
  setQuantityForSymbol: (symbol: string, quantity: number) => void;
  setDefaultExpiration: (type: ExpirationType) => void;
  updatePrices: (symbol: string, price: number) => void;
  fillPendingOrders: (symbol: string, currentPrice: number, previousPrice: number | null, appLoadTime: number) => void;
  activateOrder: (id: string, executionPrice: number) => void;
  expireOrders: () => void;
  clearAllData: () => void;
  syncWithElectron: () => Promise<void>;
  saveToElectron: () => Promise<void>;
  setTradingFees: (fees: Partial<TradingFees>) => void;
  getTradingFees: () => TradingFees;
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
          openTime: new Date(p.openTime),
        })),
      }));

      const orders = result.data.orders.map((order) => {
        const baseOrder = {
          ...order,
          createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
        } as Order;
        
        if (order.filledAt) baseOrder.filledAt = new Date(order.filledAt);
        if (order.closedAt) baseOrder.closedAt = new Date(order.closedAt);
        if (order.expirationDate) baseOrder.expirationDate = new Date(order.expirationDate);
        
        return baseOrder;
      });

      const activeWalletId =
        result.data.activeWalletId ||
        (wallets.length > 0 ? wallets[0]?.id || null : null);

      return {
        wallets,
        orders,
        isSimulatorActive: result.data.isSimulatorActive,
        activeWalletId,
        defaultQuantity: result.data.defaultQuantity,
        quantityBySymbol: result.data.quantityBySymbol || {},
        defaultExpiration: result.data.defaultExpiration,
        tradingFees: result.data.tradingFees || {
          makerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_MAKER,
          takerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_TAKER,
          vipLevel: 0,
          hasBNBDiscount: false,
          lastUpdated: Date.now(),
        },
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
      quantityBySymbol: state.quantityBySymbol,
      defaultExpiration: state.defaultExpiration as 'gtc' | 'day' | 'custom',
      tradingFees: state.tradingFees,
    });
  } catch (error) {
    console.error('Failed to save trading data to Electron:', error);
  }
};

export const useTradingStore = create<TradingState>((set, get) => {
  const setWithSync = (
    partial: Partial<TradingState> | ((state: TradingState) => Partial<TradingState>)
  ): void => {
    if (typeof partial === 'function') {
      set((state) => partial(state));
    } else {
      set(partial);
    }
    void saveToElectron(get());
  };

  return {
    isSimulatorActive: false,
    wallets: [],
    activeWalletId: null,
    orders: [],
    defaultQuantity: 1,
    quantityBySymbol: {},
    defaultExpiration: 'gtc',
    tradingFees: {
      makerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_MAKER,
      takerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_TAKER,
      vipLevel: 0,
      hasBNBDiscount: false,
      lastUpdated: Date.now(),
    },

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
                openTime: new Date(),
                balance: initialBalance,
                pnl: 0,
                pnlPercent: 0,
              },
            ],
            makerCommission: 0,
            takerCommission: 0,
            buyerCommission: 0,
            sellerCommission: 0,
            commissionRates: {
              maker: '0',
              taker: '0',
              buyer: '0',
              seller: '0',
            },
            canTrade: true,
            canWithdraw: true,
            canDeposit: true,
            brokered: false,
            requireSelfTradePrevention: false,
            preventSor: false,
            updateTime: Date.now(),
            accountType: 'SPOT',
            balances: [],
            permissions: ['SPOT'],
          };
          const wallets = [...state.wallets, newWallet];
          return {
            wallets,
            activeWalletId: state.activeWalletId ?? newWallet.id,
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
            openTime: new Date(),
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
          const newOrder = {
            ...orderData,
            id: nanoid(),
            createdAt: new Date(),
          } as Order;
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

          const isActive = isOrderActive(order);
          
          const relatedOrders = isActive ? state.orders.filter(
            (o) =>
              o.walletId === order.walletId &&
              o.symbol === order.symbol &&
              o.orderDirection === order.orderDirection &&
              isOrderActive(o)
          ) : [order];

          let totalPnl = 0;
          let totalInvestment = 0;

          if (isActive) {
            relatedOrders.forEach((o) => {
              const price = getOrderPrice(o);
              const qty = getOrderQuantity(o);
              const orderPnl =
                (closePrice - price) *
                qty *
                (isOrderLong(o) ? 1 : -1);
              totalPnl += orderPnl;
              totalInvestment += price * qty;
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
                  const price = getOrderPrice(o);
                  const qty = getOrderQuantity(o);
                  const orderPnl = isActive
                    ? (closePrice - price) *
                      qty *
                      (isOrderLong(o) ? 1 : -1)
                    : 0;
                  const orderPnlPercent = isActive
                    ? (orderPnl / (price * qty)) * 100
                    : 0;
                  
                  const totalFeesNum = typeof o.totalFees === 'string' ? parseFloat(o.totalFees) : (o.totalFees ?? 0);
                  const orderNetPnl = orderPnl - totalFeesNum;
                  const orderNetPnlPercent = isActive
                    ? (orderNetPnl / (price * qty)) * 100
                    : 0;

                  return {
                    ...o,
                    closedAt: new Date(),
                    pnl: orderPnl.toString(),
                    pnlPercent: orderPnlPercent,
                    netPnl: orderNetPnl.toString(),
                    netPnlPercent: orderNetPnlPercent,
                    currentPrice: closePrice,
                  } as unknown as Order;
                }
                return o;
              }),
              wallets: updatedWallets,
            };
          }

          return {
            orders: state.orders.map((o) => {
              if (relatedOrderIds.has(o.id)) {
                const price = getOrderPrice(o);
                const qty = getOrderQuantity(o);
                const orderPnl = isActive
                  ? (closePrice - price) *
                    qty *
                    (isOrderLong(o) ? 1 : -1)
                  : 0;
                const orderPnlPercent = isActive
                  ? (orderPnl / (price * qty)) * 100
                  : 0;
                
                const totalFeesNum = typeof o.totalFees === 'string' ? parseFloat(o.totalFees || '0') : (o.totalFees ?? 0);
                const orderNetPnl = orderPnl - totalFeesNum;
                const orderNetPnlPercent = isActive
                  ? (orderNetPnl / (price * qty)) * 100
                  : 0;

                return {
                  ...o,
                  closedAt: new Date(),
                  pnl: orderPnl.toString(),
                  pnlPercent: orderPnlPercent,
                  netPnl: orderNetPnl.toString(),
                  netPnlPercent: orderNetPnlPercent,
                  currentPrice: closePrice,
                } as unknown as Order;
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
          (o) => o.walletId === targetWalletId && isOrderActive(o)
        );

        const positionMap = new Map<string, Position>();

        activeOrders.forEach((order) => {
          const existing = positionMap.get(order.symbol);
          const price = getOrderPrice(order);
          const qty = getOrderQuantity(order);
          const orderQuantity = isOrderLong(order) ? qty : -qty;
          
          if (existing) {
            const newQuantity = existing.quantity + orderQuantity;
            const totalInvestment = Math.abs(existing.avgPrice * existing.quantity) + Math.abs(price * orderQuantity);
            const avgPrice = totalInvestment / Math.abs(newQuantity || 1);
            const currentPrice = order.currentPrice || price;
            const pnl = newQuantity >= 0 
              ? (currentPrice - avgPrice) * newQuantity
              : (avgPrice - currentPrice) * Math.abs(newQuantity);
            const pnlPercent = (pnl / (avgPrice * Math.abs(newQuantity || 1))) * 100;

            positionMap.set(order.symbol, {
              symbol: order.symbol,
              quantity: newQuantity,
              avgPrice,
              currentPrice,
              pnl,
              pnlPercent,
              orders: [...existing.orders, getOrderId(order)],
            });
          } else {
            const price = getOrderPrice(order);
            const qty = getOrderQuantity(order);
            const currentPrice = order.currentPrice || price;
            const pnl = isOrderLong(order)
              ? (currentPrice - price) * qty
              : (price - currentPrice) * qty;
            const pnlPercent = (pnl / (price * qty)) * 100;

            positionMap.set(order.symbol, {
              symbol: order.symbol,
              quantity: orderQuantity,
              avgPrice: price,
              currentPrice,
              pnl,
              pnlPercent,
              orders: [getOrderId(order)],
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
          (o) => isOrderActive(o) || isOrderPending(o)
        );
      },

      setDefaultQuantity: (quantity) => setWithSync({ defaultQuantity: quantity }),

      getQuantityForSymbol: (symbol) => {
        const state = get();
        return state.quantityBySymbol[symbol] ?? state.defaultQuantity;
      },

      setQuantityForSymbol: (symbol, quantity) =>
        setWithSync((state) => ({
          quantityBySymbol: {
            ...state.quantityBySymbol,
            [symbol]: quantity,
          },
        })),

      setDefaultExpiration: (type) => setWithSync({ defaultExpiration: type }),

      fillPendingOrders: (symbol, currentPrice, previousPrice, appLoadTime) =>
        setWithSync((state) => {
          if (previousPrice === null) return state;
          
          const now = Date.now();
          let hasChanges = false;
          const ordersToActivate: Order[] = [];
          
          const updatedOrders = state.orders.map((order) => {
            if (order.symbol !== symbol) return order;

            if (isOrderActive(order)) {
              if (order.stopLoss || order.takeProfit) {
                const hitStopLoss = order.stopLoss && (
                  (isOrderLong(order) && currentPrice <= order.stopLoss) ||
                  (!isOrderLong(order) && currentPrice >= order.stopLoss)
                );

                const hitTakeProfit = order.takeProfit && (
                  (isOrderLong(order) && currentPrice >= order.takeProfit) ||
                  (!isOrderLong(order) && currentPrice <= order.takeProfit)
                );

                if (hitStopLoss || hitTakeProfit) {
                  hasChanges = true;
                  const exitPrice = hitStopLoss ? order.stopLoss! : order.takeProfit!;
                  const price = getOrderPrice(order);
                  const qty = getOrderQuantity(order);
                  const orderPnl = isOrderLong(order)
                    ? (exitPrice - price) * qty
                    : (price - exitPrice) * qty;
                  const orderPnlPercent = (orderPnl / (price * qty)) * 100;

                  const wallet = state.wallets.find(w => w.id === order.walletId);
                  if (wallet) {
                    const totalInvestment = price * qty;
                    const commission = order.commission || 0;
                    state.wallets = state.wallets.map(w =>
                      w.id === wallet.id
                        ? { ...w, balance: w.balance + totalInvestment + orderPnl - commission }
                        : w
                    );
                  }

                  return {
                    ...order,
                    closedAt: new Date(),
                    exitPrice,
                    pnl: orderPnl.toString(),
                    pnlPercent: orderPnlPercent,
                    currentPrice: exitPrice,
                  } as unknown as Order;
                }
              }
              return order;
            }

            if (!isOrderPending(order)) return order;

            if (order.expiresAt && order.expiresAt < now) {
              hasChanges = true;
              return {
                ...order,
                status: 'EXPIRED' as OrderStatus,
              };
            }

            const createdAt = order.createdAt || new Date(order.time || Date.now());
            const orderTime = createdAt.getTime();
            if (orderTime > now || orderTime < appLoadTime) return order;

            const entryPrice = getOrderPrice(order);
            const priceCrossed = (previousPrice < entryPrice && currentPrice >= entryPrice) || 
                                 (previousPrice > entryPrice && currentPrice <= entryPrice);

            if (priceCrossed) {
              hasChanges = true;
              const qty = getOrderQuantity(order);
              const investment = entryPrice * qty;
              const commission = order.commissionRate ? investment * order.commissionRate : 0;
              
              const wallet = state.wallets.find(w => w.id === order.walletId);
              if (wallet) {
                state.wallets = state.wallets.map(w =>
                  w.id === wallet.id
                    ? { ...w, balance: w.balance - investment - commission }
                    : w
                );
              }

              const activatedOrder = {
                ...order,
                status: 'FILLED' as OrderStatus,
                filledAt: new Date(),
                currentPrice,
                commission,
              };
              ordersToActivate.push(activatedOrder);
              return activatedOrder;
            }

            return order;
          });

          if (!hasChanges) return state;

          let finalOrders = [...updatedOrders];
          
          ordersToActivate.forEach((newOrder) => {
            const oppositeType = newOrder.orderDirection === 'long' ? 'short' : 'long';
            const oppositeOrders = finalOrders.filter(
              o => o.walletId === newOrder.walletId &&
                   o.symbol === newOrder.symbol &&
                   o.orderDirection === oppositeType &&
                   isOrderActive(o as unknown as Order) &&
                   o.id !== newOrder.id
            );

            if (oppositeOrders.length === 0) return;

            let remainingQuantity = newOrder.quantity;
            const ordersToClose: string[] = [];
            const ordersToReduce: Array<{ id: string; newQuantity: number }> = [];
            let remaining = remainingQuantity ?? 0;

            oppositeOrders.forEach((opposite) => {
              if (remaining <= 0) return;

              const oppositeQty = getOrderQuantity(opposite);
              const oppositeId = getOrderId(opposite);

              if (oppositeQty <= remaining) {
                ordersToClose.push(oppositeId);
                remaining -= oppositeQty;
              } else {
                ordersToReduce.push({
                  id: oppositeId,
                  newQuantity: oppositeQty - remaining,
                });
                remaining = 0;
              }
            });
            remainingQuantity = remaining;

            finalOrders = finalOrders.map(o => {
              const order = o;
              const orderId = getOrderId(order);
              if (ordersToClose.includes(orderId)) {
                const price = getOrderPrice(order);
                const qty = getOrderQuantity(order);
                const orderPnl = isOrderLong(order)
                  ? (currentPrice - price) * qty
                  : (price - currentPrice) * qty;
                const orderPnlPercent = (orderPnl / (price * qty)) * CHART_CONFIG.PERCENT_MULTIPLIER;

                return {
                  ...order,
                  closedAt: new Date(),
                  pnl: orderPnl.toString(),
                  pnlPercent: orderPnlPercent,
                  currentPrice,
                } as unknown as Order;
              }

              const reduction = ordersToReduce.find(r => r.id === orderId);
              if (reduction) {
                return { ...o, quantity: reduction.newQuantity } as unknown as Order;
              }

              const newOrderId = getOrderId(newOrder);
              const newOrderQty = getOrderQuantity(newOrder);
              
              if (orderId === newOrderId && remainingQuantity === 0) {
                const price = getOrderPrice(newOrder);
                const qty = getOrderQuantity(newOrder);
                const orderPnl = isOrderLong(newOrder)
                  ? (currentPrice - price) * qty
                  : (price - currentPrice) * qty;
                const orderPnlPercent = (orderPnl / (price * qty)) * CHART_CONFIG.PERCENT_MULTIPLIER;

                return {
                  ...order,
                  closedAt: new Date(),
                  pnl: orderPnl.toString(),
                  pnlPercent: orderPnlPercent,
                } as unknown as Order;
              }

              if (orderId === newOrderId && remainingQuantity !== undefined && remainingQuantity < newOrderQty) {
                return { ...order, quantity: remainingQuantity } as unknown as Order;
              }

              return order;
            });

            const wallet = state.wallets.find(w => w.id === newOrder.walletId);
            if (wallet) {
              const totalClosed = ordersToClose.length;
              if (totalClosed > 0 || remainingQuantity === 0) {
                const closedOrders = finalOrders.filter(o => {
                  const oid = getOrderId(o);
                  const newOid = getOrderId(newOrder);
                  return ordersToClose.includes(oid) || (oid === newOid && remainingQuantity === 0);
                });
                const totalPnl = closedOrders.reduce((sum, o) => {
                  const pnlValue = typeof o.pnl === 'string' ? parseFloat(o.pnl) : (o.pnl ?? 0);
                  return sum + pnlValue;
                }, 0);
                const totalInvestment = closedOrders.reduce((sum, o) => {
                  const price = getOrderPrice(o);
                  const qty = getOrderQuantity(o);
                  return sum + (price * qty);
                }, 0);

                state.wallets = state.wallets.map(w =>
                  w.id === wallet.id
                    ? { ...w, balance: w.balance + totalInvestment + totalPnl }
                    : w
                );
              }
            }
          });

          return { orders: finalOrders, wallets: state.wallets };
        }),

      activateOrder: (id, executionPrice) =>
        setWithSync((state) => {
          const order = state.orders.find((o) => o.id === id);
          if (!order || !isOrderPending(order)) return state;

          const wallet = state.wallets.find((w) => w.id === order.walletId);
          if (!wallet) return state;

          const updatedOrders = state.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: 'FILLED' as OrderStatus,
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
              isOrderPending(order) &&
              order.expirationDate &&
              order.expirationDate < now
            ) {
              return { ...order, status: 'EXPIRED' as OrderStatus };
            }
            return order;
          });

          return { orders: updatedOrders };
        }),

      updatePrices: (symbol, price) =>
        setWithSync((state) => ({
          orders: state.orders.map((o) =>
            o.symbol === symbol && (isOrderActive(o) || isOrderPending(o))
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
          quantityBySymbol: {},
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

    setTradingFees: (fees) =>
      setWithSync((state) => ({
        tradingFees: {
          ...state.tradingFees,
          ...fees,
          lastUpdated: Date.now(),
        },
      })),

    getTradingFees: () => get().tradingFees,
  };
});
