import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { orders, tradeExecutions, wallets } from '../../db/schema';
import { priceCache } from '../../services/price-cache';
import { checkPaperPendingOrders } from '../../services/trading/paper-order-engine';
import { createAuthenticatedCaller } from '../helpers/test-caller';
import { cleanupTables, getTestDatabase, setupTestDatabase, teardownTestDatabase } from '../helpers/test-db';
import { createAuthenticatedUser, createTestWallet } from '../helpers/test-fixtures';

vi.mock('binance', async () => {
  const actual = await vi.importActual<typeof import('binance')>('binance');
  class StubClient {
    setTimeOffset() {}
    getTimeOffset() { return 0; }
  }
  return { ...actual, USDMClient: StubClient, MainClient: StubClient };
});

const SYMBOL = 'BTCUSDT';
const INITIAL_BALANCE = 10_000;
const FUTURES_TAKER_FEE_RATE = 0.0005;
const SPOT_TAKER_FEE_RATE = 0.001;

type MarketType = 'SPOT' | 'FUTURES';

const setMarketPrice = (price: number, marketType: MarketType = 'FUTURES'): void => {
  priceCache.updateFromWebSocket(SYMBOL, marketType, price);
};

const setup = async (marketType: MarketType = 'FUTURES') => {
  const { user, session } = await createAuthenticatedUser();
  const wallet = await createTestWallet({ userId: user.id, walletType: 'paper', marketType });
  const caller = createAuthenticatedCaller(user, session);
  const db = getTestDatabase();

  const executionsWithStatus = (status: string) =>
    db.select().from(tradeExecutions).where(eq(tradeExecutions.walletId, wallet.id))
      .then((rows) => rows.filter((row) => row.status === status));

  const balance = async (): Promise<number> => {
    const [row] = await db.select().from(wallets).where(eq(wallets.id, wallet.id));
    return parseFloat(row?.currentBalance ?? '0');
  };

  const orderStatus = async (orderId: string): Promise<string | undefined> => {
    const [row] = await db.select().from(orders).where(eq(orders.orderId, orderId));
    return row?.status;
  };

  const place = (order: {
    side: 'BUY' | 'SELL';
    type?: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
    quantity: string;
    price?: string;
    stopPrice?: string;
    reduceOnly?: boolean;
  }) =>
    caller.trading.createOrder({
      walletId: wallet.id,
      symbol: SYMBOL,
      marketType,
      type: 'MARKET',
      ...order,
    });

  return { wallet, caller, executionsWithStatus, balance, orderStatus, place };
};

describe('Paper order engine', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    setMarketPrice(50_000);
    setMarketPrice(50_000, 'SPOT');
  });

  describe('market orders on futures', () => {
    it('opens a LONG position at the market price and records the entry fee', async () => {
      const { place, executionsWithStatus, orderStatus, balance } = await setup();

      const order = await place({ side: 'BUY', quantity: '0.1' });

      const [position] = await executionsWithStatus('open');
      expect(order.status).toBe('FILLED');
      expect(await orderStatus(order.orderId)).toBe('FILLED');
      expect(position?.side).toBe('LONG');
      expect(parseFloat(position!.entryPrice)).toBe(50_000);
      expect(parseFloat(position!.quantity)).toBe(0.1);
      expect(parseFloat(position!.entryFee!)).toBeCloseTo(50_000 * 0.1 * FUTURES_TAKER_FEE_RATE, 8);
      expect(position?.entryOrderId).toBe(order.orderId);
      expect(order.openExecutions).toHaveLength(1);
      expect(await balance()).toBe(INITIAL_BALANCE);
    });

    it('stores the break-even price that covers the taker fee on both legs', async () => {
      const { place, executionsWithStatus } = await setup();

      await place({ side: 'BUY', quantity: '0.1' });
      const [long] = await executionsWithStatus('open');
      const longBreakeven = parseFloat(long!.breakevenPrice!);
      expect(longBreakeven).toBeCloseTo(50_000 * (1 + FUTURES_TAKER_FEE_RATE) / (1 - FUTURES_TAKER_FEE_RATE), 6);

      setMarketPrice(longBreakeven);
      await place({ side: 'SELL', quantity: '0.1' });
      const [closed] = await executionsWithStatus('closed');
      expect(parseFloat(closed!.pnl!)).toBeCloseTo(0, 6);
    });

    it('moves the break-even price to the merged entry when the position grows', async () => {
      const { place, executionsWithStatus } = await setup();
      await place({ side: 'SELL', quantity: '0.1' });

      setMarketPrice(52_000);
      await place({ side: 'SELL', quantity: '0.1' });

      const [short] = await executionsWithStatus('open');
      expect(parseFloat(short!.breakevenPrice!)).toBeCloseTo(51_000 * (1 - FUTURES_TAKER_FEE_RATE) / (1 + FUTURES_TAKER_FEE_RATE), 6);
    });

    it('opens a SHORT position on a SELL', async () => {
      const { place, executionsWithStatus } = await setup();

      await place({ side: 'SELL', quantity: '0.1' });

      const [position] = await executionsWithStatus('open');
      expect(position?.side).toBe('SHORT');
    });

    it('closes a LONG with an opposite order and credits the net PnL to the balance', async () => {
      const { place, executionsWithStatus, balance } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      setMarketPrice(51_000);
      await place({ side: 'SELL', quantity: '0.1' });

      const [closed] = await executionsWithStatus('closed');
      const fees = (50_000 + 51_000) * 0.1 * FUTURES_TAKER_FEE_RATE;
      const expectedPnl = 100 - fees;
      expect(await executionsWithStatus('open')).toHaveLength(0);
      expect(parseFloat(closed!.exitPrice!)).toBe(51_000);
      expect(parseFloat(closed!.pnl!)).toBeCloseTo(expectedPnl, 6);
      expect(await balance()).toBeCloseTo(INITIAL_BALANCE + expectedPnl, 6);
    });

    it('returns the wallet with an empty open list when the order closes the last position', async () => {
      const { place, wallet } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      const closing = await place({ side: 'SELL', quantity: '0.1' });

      expect(closing.walletId).toBe(wallet.id);
      expect(closing.openExecutions).toEqual([]);
    });

    it('closes a SHORT at a loss when the price rises', async () => {
      const { place, executionsWithStatus, balance } = await setup();
      await place({ side: 'SELL', quantity: '0.1' });

      setMarketPrice(51_000);
      await place({ side: 'BUY', quantity: '0.1' });

      const [closed] = await executionsWithStatus('closed');
      const expectedPnl = -100 - (50_000 + 51_000) * 0.1 * FUTURES_TAKER_FEE_RATE;
      expect(parseFloat(closed!.pnl!)).toBeCloseTo(expectedPnl, 6);
      expect(await balance()).toBeCloseTo(INITIAL_BALANCE + expectedPnl, 6);
    });

    it('reduces the position and realizes only the closed share on a smaller opposite order', async () => {
      const { place, executionsWithStatus, balance } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      setMarketPrice(51_000);
      await place({ side: 'SELL', quantity: '0.04' });

      const [position] = await executionsWithStatus('open');
      const realized = 0.04 * 1_000 - (50_000 + 51_000) * 0.04 * FUTURES_TAKER_FEE_RATE;
      expect(parseFloat(position!.quantity)).toBeCloseTo(0.06, 8);
      expect(parseFloat(position!.entryPrice)).toBe(50_000);
      expect(parseFloat(position!.partialClosePnl!)).toBeCloseTo(realized, 6);
      expect(parseFloat(position!.entryFee!)).toBeCloseTo(50_000 * 0.06 * FUTURES_TAKER_FEE_RATE, 8);
      expect(await balance()).toBeCloseTo(INITIAL_BALANCE + realized, 6);
    });

    it('flips to the opposite side when the opposite order is larger than the position', async () => {
      const { place, executionsWithStatus } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      await place({ side: 'SELL', quantity: '0.25' });

      const [position] = await executionsWithStatus('open');
      expect(await executionsWithStatus('closed')).toHaveLength(1);
      expect(position?.side).toBe('SHORT');
      expect(parseFloat(position!.quantity)).toBeCloseTo(0.15, 8);
    });

    it('does not flip when the larger opposite order is reduce-only', async () => {
      const { place, executionsWithStatus } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      await place({ side: 'SELL', quantity: '0.25', reduceOnly: true });

      expect(await executionsWithStatus('open')).toHaveLength(0);
      expect(await executionsWithStatus('closed')).toHaveLength(1);
    });

    it('merges a same-side order into the open position at the weighted average price', async () => {
      const { place, executionsWithStatus } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      setMarketPrice(52_000);
      await place({ side: 'BUY', quantity: '0.1' });

      const open = await executionsWithStatus('open');
      expect(open).toHaveLength(1);
      expect(parseFloat(open[0]!.quantity)).toBeCloseTo(0.2, 8);
      expect(parseFloat(open[0]!.entryPrice)).toBeCloseTo(51_000, 6);
      expect(parseFloat(open[0]!.entryFee!)).toBeCloseTo((50_000 + 52_000) * 0.1 * FUTURES_TAKER_FEE_RATE, 8);
    });

    it('rejects a reduce-only order when there is no position to reduce', async () => {
      const { place } = await setup();

      await expect(place({ side: 'SELL', quantity: '0.1', reduceOnly: true })).rejects.toThrow('Reduce-only order rejected');
    });
  });

  describe('pending orders on futures', () => {
    it('keeps a LIMIT buy below the market pending until the price trades down to it, then fills at the limit price', async () => {
      const { place, executionsWithStatus, orderStatus } = await setup();

      const order = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '49000' });
      expect(order.status).toBe('NEW');
      expect(await executionsWithStatus('pending')).toHaveLength(1);

      setMarketPrice(49_500);
      await checkPaperPendingOrders();
      expect(await executionsWithStatus('open')).toHaveLength(0);

      setMarketPrice(48_900);
      await checkPaperPendingOrders();

      const [position] = await executionsWithStatus('open');
      expect(await executionsWithStatus('pending')).toHaveLength(0);
      expect(position?.side).toBe('LONG');
      expect(parseFloat(position!.entryPrice)).toBe(49_000);
      expect(parseFloat(position!.entryFee!)).toBeCloseTo(49_000 * 0.1 * FUTURES_TAKER_FEE_RATE, 8);
      expect(await orderStatus(order.orderId)).toBe('FILLED');
    });

    it('fills a STOP buy above the market at the observed price once the trigger is crossed', async () => {
      const { place, executionsWithStatus } = await setup();

      await place({ side: 'BUY', type: 'STOP_MARKET', quantity: '0.1', stopPrice: '51000' });
      setMarketPrice(50_500);
      await checkPaperPendingOrders();
      expect(await executionsWithStatus('open')).toHaveLength(0);

      setMarketPrice(51_200);
      await checkPaperPendingOrders();

      const [position] = await executionsWithStatus('open');
      expect(parseFloat(position!.entryPrice)).toBe(51_200);
      expect(position?.entryOrderType).toBe('STOP_MARKET');
    });

    it('turns a LIMIT that crosses the market into a stop entry instead of filling it', async () => {
      const { place, executionsWithStatus } = await setup();

      const order = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '51000' });

      const [pending] = await executionsWithStatus('pending');
      expect(order.status).toBe('NEW');
      expect(order.type).toBe('STOP_MARKET');
      expect(pending?.entryOrderType).toBe('STOP_MARKET');
    });

    it('rejects a STOP whose trigger is already crossed', async () => {
      const { place } = await setup();

      await expect(
        place({ side: 'BUY', type: 'STOP_MARKET', quantity: '0.1', stopPrice: '49000' }),
      ).rejects.toThrow('Order would trigger immediately');
    });

    it('stores a LIMIT sell against an open LONG as a reduce order and closes the position when it fills', async () => {
      const { place, executionsWithStatus, balance } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });

      await place({ side: 'SELL', type: 'LIMIT', quantity: '0.1', price: '52000' });
      expect(await executionsWithStatus('pending')).toHaveLength(0);

      setMarketPrice(52_100);
      await checkPaperPendingOrders();

      const [closed] = await executionsWithStatus('closed');
      const expectedPnl = 200 - (50_000 + 52_000) * 0.1 * FUTURES_TAKER_FEE_RATE;
      expect(parseFloat(closed!.exitPrice!)).toBe(52_000);
      expect(await balance()).toBeCloseTo(INITIAL_BALANCE + expectedPnl, 6);
    });

    it('expires a pending reduce order when the position is gone by the time it triggers', async () => {
      const { place, orderStatus, executionsWithStatus } = await setup();
      await place({ side: 'BUY', quantity: '0.1' });
      const reduceOrder = await place({ side: 'SELL', type: 'LIMIT', quantity: '0.1', price: '52000' });
      await place({ side: 'SELL', quantity: '0.1' });

      setMarketPrice(52_100);
      await checkPaperPendingOrders();

      expect(await orderStatus(reduceOrder.orderId)).toBe('EXPIRED');
      expect(await executionsWithStatus('open')).toHaveLength(0);
    });

    it('cancels the pending execution together with its order', async () => {
      const { place, caller, wallet, executionsWithStatus, orderStatus } = await setup();
      const order = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '49000' });

      await caller.trading.cancelOrder({ walletId: wallet.id, symbol: SYMBOL, orderId: order.orderId });

      setMarketPrice(48_000);
      await checkPaperPendingOrders();
      expect(await orderStatus(order.orderId)).toBe('CANCELED');
      expect(await executionsWithStatus('cancelled')).toHaveLength(1);
      expect(await executionsWithStatus('open')).toHaveLength(0);
    });

    it('cancels every pending order and execution of the symbol on cancel-all', async () => {
      const { place, caller, wallet, executionsWithStatus, orderStatus } = await setup();
      const first = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '49000' });
      const second = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '48000' });

      const result = await caller.futuresTrading.cancelAllOrders({ walletId: wallet.id, symbol: SYMBOL });

      expect(result.cancelled).toBe(2);
      expect(await orderStatus(first.orderId)).toBe('CANCELED');
      expect(await orderStatus(second.orderId)).toBe('CANCELED');
      expect(await executionsWithStatus('pending')).toHaveLength(0);
    });

    it('does not cancel an order that belongs to another wallet', async () => {
      const owner = await setup();
      const other = await setup();
      const order = await owner.place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '49000' });

      await other.caller.trading.cancelOrder({ walletId: other.wallet.id, symbol: SYMBOL, orderId: order.orderId });

      expect(await owner.orderStatus(order.orderId)).toBe('NEW');
      expect(await owner.executionsWithStatus('pending')).toHaveLength(1);
    });

    it('cancels the order when its pending execution is cancelled from the position side', async () => {
      const { place, caller, executionsWithStatus, orderStatus } = await setup();
      const order = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '49000' });
      const [pending] = await executionsWithStatus('pending');

      await caller.trading.closeTradeExecution({ id: pending!.id });

      expect(await orderStatus(order.orderId)).toBe('CANCELED');
    });
  });

  describe('futures router', () => {
    it('attaches stop loss and take profit to the position opened by a market order', async () => {
      const { caller, wallet, executionsWithStatus } = await setup();

      await caller.futuresTrading.createOrder({
        walletId: wallet.id,
        symbol: SYMBOL,
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.1',
        stopLoss: '49000',
        takeProfit: '52000',
        leverage: 10,
      });

      const [position] = await executionsWithStatus('open');
      expect(parseFloat(position!.stopLoss!)).toBe(49_000);
      expect(parseFloat(position!.takeProfit!)).toBe(52_000);
      expect(position?.leverage).toBe(10);
      expect(parseFloat(position!.liquidationPrice!)).toBeGreaterThan(0);
      expect(parseFloat(position!.liquidationPrice!)).toBeLessThan(50_000);
    });

    it('rejects a stop loss on the wrong side of the entry', async () => {
      const { caller, wallet } = await setup();

      await expect(
        caller.futuresTrading.createOrder({
          walletId: wallet.id,
          symbol: SYMBOL,
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.1',
          stopLoss: '51000',
        }),
      ).rejects.toThrow('Stop loss must be below the entry price');
    });
  });

  describe('spot', () => {
    it('opens a LONG on a BUY and closes it on a SELL of the held quantity', async () => {
      const { place, executionsWithStatus, balance } = await setup('SPOT');
      await place({ side: 'BUY', quantity: '0.1' });

      setMarketPrice(51_000, 'SPOT');
      await place({ side: 'SELL', quantity: '0.1' });

      const expectedPnl = 100 - (50_000 + 51_000) * 0.1 * SPOT_TAKER_FEE_RATE;
      expect(await executionsWithStatus('open')).toHaveLength(0);
      expect(await executionsWithStatus('closed')).toHaveLength(1);
      expect(await balance()).toBeCloseTo(INITIAL_BALANCE + expectedPnl, 6);
    });

    it('rejects a SELL when nothing is held, so a short can never open', async () => {
      const { place, executionsWithStatus } = await setup('SPOT');

      await expect(place({ side: 'SELL', quantity: '0.1' })).rejects.toThrow('Spot wallets cannot open short positions');
      expect(await executionsWithStatus('open')).toHaveLength(0);
    });

    it('rejects a SELL larger than the held quantity', async () => {
      const { place } = await setup('SPOT');
      await place({ side: 'BUY', quantity: '0.1' });

      await expect(place({ side: 'SELL', quantity: '0.2' })).rejects.toThrow('only 0.10000000 held');
    });

    it('rejects a pending SELL when nothing is held', async () => {
      const { place } = await setup('SPOT');

      await expect(
        place({ side: 'SELL', type: 'LIMIT', quantity: '0.1', price: '52000' }),
      ).rejects.toThrow('Spot wallets cannot open short positions');
    });

    it('fills a LIMIT buy that crosses the market right away at the market price', async () => {
      const { place, executionsWithStatus } = await setup('SPOT');

      const order = await place({ side: 'BUY', type: 'LIMIT', quantity: '0.1', price: '51000' });

      const [position] = await executionsWithStatus('open');
      expect(order.status).toBe('FILLED');
      expect(parseFloat(position!.entryPrice)).toBe(50_000);
    });
  });
});
