import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Wallet } from '../../db/schema';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: (e: unknown) => e,
}));

vi.mock('../../services/encryption', () => ({
  decryptApiKey: (encrypted: string) => encrypted === 'encrypted-key' ? 'real-api-key' : encrypted,
}));

const mockMethods = {
  setLeverage: vi.fn(),
  setMarginType: vi.fn(),
  setIsolatedPositionMargin: vi.fn(),
  getPositionsV3: vi.fn(),
  getAccountInformationV3: vi.fn(),
  getFuturesSymbolConfig: vi.fn(),
  submitNewOrder: vi.fn(),
  cancelOrder: vi.fn(),
  cancelAllOpenOrders: vi.fn(),
  getAllOpenOrders: vi.fn(),
  getNotionalAndLeverageBrackets: vi.fn(),
};

vi.mock('binance', () => ({
  USDMClient: class MockUSDMClient {
    setLeverage = mockMethods.setLeverage;
    setMarginType = mockMethods.setMarginType;
    setIsolatedPositionMargin = mockMethods.setIsolatedPositionMargin;
    getPositionsV3 = mockMethods.getPositionsV3;
    getAccountInformationV3 = mockMethods.getAccountInformationV3;
    getFuturesSymbolConfig = mockMethods.getFuturesSymbolConfig;
    submitNewOrder = mockMethods.submitNewOrder;
    cancelOrder = mockMethods.cancelOrder;
    cancelAllOpenOrders = mockMethods.cancelAllOpenOrders;
    getAllOpenOrders = mockMethods.getAllOpenOrders;
    getNotionalAndLeverageBrackets = mockMethods.getNotionalAndLeverageBrackets;
  },
}));

const {
  isPaperWallet,
  getWalletType,
  createBinanceFuturesClient,
  createBinanceFuturesClientForPrices,
  setLeverage,
  setMarginType,
  modifyIsolatedPositionMargin,
  getPositions,
  getPosition,
  getConfiguredLeverage,
  getAccountInfo,
  submitFuturesOrder,
  cancelFuturesOrder,
  cancelAllFuturesOrders,
  closePosition,
  getOpenOrders,
  getSymbolLeverageBrackets,
  __resetSymbolConfigCache,
} = await import('../../services/binance-futures-client');

describe('BinanceFuturesClient Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: '1',
    userId: '1',
    name: 'Test Wallet',
    apiKeyEncrypted: 'encrypted-key',
    apiSecretEncrypted: 'encrypted-secret',
    walletType: 'live',
    marketType: 'FUTURES',
    initialBalance: null,
    currentBalance: null,
    totalWalletBalance: null,
    totalDeposits: null,
    totalWithdrawals: null,
    lastTransferSyncAt: null,
    currency: null,
    exchange: 'BINANCE',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    agentTradingEnabled: false,
    ...overrides,
  });

  describe('isPaperWallet', () => {
    it('should return true for paper wallet type', () => {
      const wallet = createMockWallet({ walletType: 'paper' });
      expect(isPaperWallet(wallet)).toBe(true);
    });

    it('should return true for paper-trading api key', () => {
      const wallet = createMockWallet({ apiKeyEncrypted: 'paper-trading' });
      expect(isPaperWallet(wallet)).toBe(true);
    });

    it('should return false for live wallet', () => {
      const wallet = createMockWallet({ walletType: 'live' });
      expect(isPaperWallet(wallet)).toBe(false);
    });

    it('should return false for testnet wallet', () => {
      const wallet = createMockWallet({ walletType: 'testnet' });
      expect(isPaperWallet(wallet)).toBe(false);
    });
  });

  describe('getWalletType', () => {
    it('should return wallet type from walletType field', () => {
      expect(getWalletType(createMockWallet({ walletType: 'live' }))).toBe('live');
      expect(getWalletType(createMockWallet({ walletType: 'testnet' }))).toBe('testnet');
      expect(getWalletType(createMockWallet({ walletType: 'paper' }))).toBe('paper');
    });

    it('should return paper for paper-trading api key', () => {
      const wallet = createMockWallet({ walletType: undefined as any, apiKeyEncrypted: 'paper-trading' });
      expect(getWalletType(wallet)).toBe('paper');
    });

    it('should default to live', () => {
      const wallet = createMockWallet({ walletType: undefined as any });
      expect(getWalletType(wallet)).toBe('live');
    });
  });

  describe('createBinanceFuturesClient', () => {
    it('should create client for live wallet', () => {
      const wallet = createMockWallet({ walletType: 'live' });
      expect(() => createBinanceFuturesClient(wallet)).not.toThrow();
    });

    it('should create client for testnet wallet', () => {
      const wallet = createMockWallet({ walletType: 'testnet' });
      expect(() => createBinanceFuturesClient(wallet)).not.toThrow();
    });

    it('should throw for paper wallet', () => {
      const wallet = createMockWallet({ walletType: 'paper' });
      expect(() => createBinanceFuturesClient(wallet)).toThrow('Paper wallets cannot execute real orders');
    });
  });

  describe('createBinanceFuturesClientForPrices', () => {
    it('should create client without credentials', () => {
      const client = createBinanceFuturesClientForPrices();
      expect(client).toBeDefined();
    });
  });

  describe('setLeverage', () => {
    it('should set leverage and return result', async () => {
      mockMethods.setLeverage.mockResolvedValue({
        leverage: 20,
        maxNotionalValue: 1000000,
        symbol: 'BTCUSDT',
      });

      const client = createBinanceFuturesClientForPrices();
      const result = await setLeverage(client, 'BTCUSDT', 20);

      expect(result.leverage).toBe(20);
      expect(result.symbol).toBe('BTCUSDT');
      expect(mockMethods.setLeverage).toHaveBeenCalledWith({ symbol: 'BTCUSDT', leverage: 20 });
    });

    it('should throw on error', async () => {
      mockMethods.setLeverage.mockRejectedValue(new Error('API error'));

      const client = createBinanceFuturesClientForPrices();
      await expect(setLeverage(client, 'BTCUSDT', 20)).rejects.toThrow('API error');
    });
  });

  describe('setMarginType', () => {
    it('should set margin type', async () => {
      mockMethods.setMarginType.mockResolvedValue({});

      const client = createBinanceFuturesClientForPrices();
      await expect(setMarginType(client, 'BTCUSDT', 'ISOLATED')).resolves.not.toThrow();
      expect(mockMethods.setMarginType).toHaveBeenCalledWith({ symbol: 'BTCUSDT', marginType: 'ISOLATED' });
    });

    it('should ignore "No need to change" error', async () => {
      mockMethods.setMarginType.mockRejectedValue(new Error('No need to change margin type'));

      const client = createBinanceFuturesClientForPrices();
      await expect(setMarginType(client, 'BTCUSDT', 'ISOLATED')).resolves.not.toThrow();
    });

    it('should throw on other errors', async () => {
      mockMethods.setMarginType.mockRejectedValue(new Error('API error'));

      const client = createBinanceFuturesClientForPrices();
      await expect(setMarginType(client, 'BTCUSDT', 'ISOLATED')).rejects.toThrow('API error');
    });
  });

  describe('modifyIsolatedPositionMargin', () => {
    it('should modify margin and return result', async () => {
      mockMethods.setIsolatedPositionMargin.mockResolvedValue({
        amount: 100,
        type: 1,
        code: 200,
        msg: 'Success',
      });

      const client = createBinanceFuturesClientForPrices();
      const result = await modifyIsolatedPositionMargin(client, 'BTCUSDT', 100, '1');

      expect(result.amount).toBe('100');
      expect(result.type).toBe(1);
    });
  });

  describe('getPositions', () => {
    it('returns filtered positions with non-zero amounts and leverage from symbolConfig', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.1', entryPrice: '50000', positionSide: 'BOTH', markPrice: '51000', unRealizedProfit: '100', liquidationPrice: '45000', isolatedMargin: '500', notional: '5100', isolatedWallet: '500', updateTime: Date.now() },
        { symbol: 'ETHUSDT', positionAmt: '0', entryPrice: '0', positionSide: 'BOTH', markPrice: '0', unRealizedProfit: '0', liquidationPrice: '0', isolatedMargin: '0', notional: '0', isolatedWallet: '0', updateTime: Date.now() },
      ]);
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'BTCUSDT', marginType: 'ISOLATED', isAutoAddMargin: false, leverage: 10, maxNotionalValue: '230000000' },
      ]);
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPositions(client);

      expect(result).toHaveLength(1);
      expect(result[0]!.symbol).toBe('BTCUSDT');
      expect(result[0]!.leverage).toBe(10);
      expect(result[0]!.marginType).toBe('isolated');
    });

    it('falls back to deriving leverage from notional/initialMargin when symbolConfig misses entry', async () => {
      // Regression: V3 dropped the leverage field from accountInfo too,
      // and symbolConfig may not list every symbol (e.g. delisted/newly
      // added). The defensive math keeps positions visible at the
      // correct leverage instead of silently falling back to 1×.
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.465', entryPrice: '78502.9', positionSide: 'BOTH', markPrice: '78320', unRealizedProfit: '-85', liquidationPrice: '70063', isolatedMargin: '0', notional: '36418.8', isolatedWallet: '0', updateTime: Date.now() },
      ]);
      // symbolConfig empty (e.g. transient miss)
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);
      // accountInfo carries the V3 shape: notional + initialMargin, no leverage.
      // 36418.8 / 3641.88 = 10
      mockMethods.getAccountInformationV3.mockResolvedValue({
        positions: [
          { symbol: 'BTCUSDT', positionSide: 'BOTH', positionAmt: '0.465', notional: '36418.8', initialMargin: '3641.88', isolatedMargin: '0', isolatedWallet: '0' },
        ],
      });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPositions(client);

      expect(result[0]!.leverage).toBe(10);
      expect(result[0]!.marginType).toBe('cross');
    });

    it('reports leverage=1 as a last-resort fallback when both sources miss', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.1', entryPrice: '50000', positionSide: 'BOTH', markPrice: '51000', unRealizedProfit: '100', liquidationPrice: '45000', isolatedMargin: '500', notional: '5100', isolatedWallet: '500', updateTime: Date.now() },
      ]);
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);
      // accountInfo also empty → no notional/initialMargin to derive from
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPositions(client);

      expect(result[0]!.leverage).toBe(1);
    });

    it('marks isolated position as isolated when symbolConfig reports ISOLATED', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'ETHUSDT', positionAmt: '1', entryPrice: '3000', positionSide: 'BOTH', markPrice: '3050', unRealizedProfit: '50', liquidationPrice: '2500', isolatedMargin: '300', notional: '3050', isolatedWallet: '300', updateTime: Date.now() },
      ]);
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'ETHUSDT', marginType: 'ISOLATED', isAutoAddMargin: false, leverage: 5, maxNotionalValue: '1000000' },
      ]);
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPositions(client);

      expect(result[0]!.marginType).toBe('isolated');
      expect(result[0]!.leverage).toBe(5);
    });

    it('should throw on error', async () => {
      mockMethods.getPositionsV3.mockRejectedValue(new Error('API error'));

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      await expect(getPositions(client)).rejects.toThrow('API error');
    });
  });

  describe('getPosition', () => {
    it('returns position for symbol with leverage from symbolConfig', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.1', entryPrice: '50000', positionSide: 'BOTH', markPrice: '51000', unRealizedProfit: '100', liquidationPrice: '45000', isolatedMargin: '500', notional: '5100', isolatedWallet: '500', updateTime: Date.now() },
      ]);
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'BTCUSDT', marginType: 'CROSSED', isAutoAddMargin: false, leverage: 10, maxNotionalValue: '230000000' },
      ]);
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPosition(client, 'BTCUSDT');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTCUSDT');
      expect(result!.leverage).toBe(10);
      expect(result!.marginType).toBe('cross');
    });

    it('falls back to notional/initialMargin math when symbolConfig misses', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0.465', entryPrice: '78502.9', positionSide: 'BOTH', markPrice: '78320', unRealizedProfit: '-85', liquidationPrice: '70063', isolatedMargin: '0', notional: '36418.8', isolatedWallet: '0', updateTime: Date.now() },
      ]);
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);
      mockMethods.getAccountInformationV3.mockResolvedValue({
        positions: [
          { symbol: 'BTCUSDT', positionSide: 'BOTH', positionAmt: '0.465', notional: '36418.8', initialMargin: '3641.88', isolatedMargin: '0', isolatedWallet: '0' },
        ],
      });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPosition(client, 'BTCUSDT');

      expect(result!.leverage).toBe(10);
    });

    it('should return null for no position', async () => {
      mockMethods.getPositionsV3.mockResolvedValue([
        { symbol: 'BTCUSDT', positionAmt: '0', entryPrice: '0', positionSide: 'BOTH', markPrice: '0', unRealizedProfit: '0', liquidationPrice: '0', isolatedMargin: '0', notional: '0', isolatedWallet: '0', updateTime: Date.now() },
      ]);

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getPosition(client, 'BTCUSDT');

      expect(result).toBeNull();
    });
  });

  describe('getConfiguredLeverage', () => {
    it('returns leverage from symbolConfig (V3 source of truth)', async () => {
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'BTCUSDT', marginType: 'CROSSED', isAutoAddMargin: false, leverage: 10, maxNotionalValue: '230000000' },
      ]);

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getConfiguredLeverage(client, 'BTCUSDT');

      expect(result).toBe(10);
      expect(mockMethods.getFuturesSymbolConfig).toHaveBeenCalledWith({ symbol: 'BTCUSDT' });
    });

    it('falls back to notional/initialMargin from accountInfo when symbolConfig empty', async () => {
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);
      mockMethods.getAccountInformationV3.mockResolvedValue({
        positions: [
          { symbol: 'BTCUSDT', positionSide: 'BOTH', positionAmt: '0.465', notional: '36418.8', initialMargin: '3641.88' },
        ],
      });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getConfiguredLeverage(client, 'BTCUSDT');

      expect(result).toBe(10);
    });

    it('returns 1 when both symbolConfig and accountInfo lack the symbol', async () => {
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getConfiguredLeverage(client, 'BTCUSDT');

      expect(result).toBe(1);
    });

    it('handles invalid leverage values defensively', async () => {
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'BTCUSDT', marginType: 'CROSSED', isAutoAddMargin: false, leverage: 0, maxNotionalValue: '0' },
      ]);
      mockMethods.getAccountInformationV3.mockResolvedValue({ positions: [] });

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      // leverage=0 is rejected; falls back to 1
      const result = await getConfiguredLeverage(client, 'BTCUSDT');

      expect(result).toBe(1);
    });
  });

  describe('getAccountInfo', () => {
    it('should return account information', async () => {
      mockMethods.getAccountInformationV3.mockResolvedValue({
        feeTier: 0,
        canTrade: true,
        canDeposit: true,
        canWithdraw: true,
        updateTime: Date.now(),
        totalInitialMargin: '1000',
        totalMaintMargin: '500',
        totalWalletBalance: '10000',
        totalUnrealizedProfit: '100',
        totalMarginBalance: '10100',
        totalPositionInitialMargin: '800',
        totalOpenOrderInitialMargin: '200',
        totalCrossWalletBalance: '9000',
        totalCrossUnPnl: '50',
        availableBalance: '9000',
        maxWithdrawAmount: '9000',
        assets: [],
        positions: [],
      });
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([]);

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getAccountInfo(client);

      expect(result.canTrade).toBe(true);
      expect(result.totalWalletBalance).toBe('10000');
    });

    it('enriches open positions with leverage from symbolConfig', async () => {
      mockMethods.getAccountInformationV3.mockResolvedValue({
        feeTier: 0,
        canTrade: true,
        canDeposit: true,
        canWithdraw: true,
        updateTime: Date.now(),
        totalInitialMargin: '3641.88',
        totalMaintMargin: '145',
        totalWalletBalance: '10000',
        totalUnrealizedProfit: '-85',
        totalMarginBalance: '9915',
        totalPositionInitialMargin: '3641.88',
        totalOpenOrderInitialMargin: '0',
        totalCrossWalletBalance: '10000',
        totalCrossUnPnl: '-85',
        availableBalance: '6358',
        maxWithdrawAmount: '6358',
        assets: [],
        positions: [
          { symbol: 'BTCUSDT', positionSide: 'BOTH', positionAmt: '0.465', entryPrice: '78502.9', notional: '36418.8', initialMargin: '3641.88', isolatedMargin: '0', isolatedWallet: '0', unrealizedProfit: '-85', updateTime: Date.now() },
        ],
      });
      mockMethods.getFuturesSymbolConfig.mockResolvedValue([
        { symbol: 'BTCUSDT', marginType: 'CROSSED', isAutoAddMargin: false, leverage: 10, maxNotionalValue: '230000000' },
      ]);

      const client = createBinanceFuturesClientForPrices();
      __resetSymbolConfigCache(client);
      const result = await getAccountInfo(client);

      expect(result.positions).toHaveLength(1);
      expect(result.positions[0]!.leverage).toBe(10);
      expect(result.positions[0]!.marginType).toBe('cross');
    });
  });

  describe('submitFuturesOrder', () => {
    it('should submit market order', async () => {
      mockMethods.submitNewOrder.mockResolvedValue({
        orderId: '123',
        symbol: 'BTCUSDT',
        status: 'NEW',
        clientOrderId: 'test-id',
        price: 0,
        avgPrice: 0,
        origQty: 0.1,
        executedQty: 0,
        cumQuote: 0,
        timeInForce: 'GTC',
        type: 'MARKET',
        reduceOnly: false,
        closePosition: false,
        side: 'BUY',
        updateTime: Date.now(),
      });

      const client = createBinanceFuturesClientForPrices();
      const result = await submitFuturesOrder(client, {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.1',
      });

      expect(result.orderId).toBe('123');
      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should submit limit order with price', async () => {
      mockMethods.submitNewOrder.mockResolvedValue({
        orderId: '124',
        symbol: 'BTCUSDT',
        status: 'NEW',
        clientOrderId: 'test-id',
        price: 50000,
        avgPrice: 0,
        origQty: 0.1,
        executedQty: 0,
        cumQuote: 0,
        timeInForce: 'GTC',
        type: 'LIMIT',
        reduceOnly: false,
        closePosition: false,
        side: 'BUY',
        updateTime: Date.now(),
      });

      const client = createBinanceFuturesClientForPrices();
      const result = await submitFuturesOrder(client, {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.1',
        price: '50000',
        timeInForce: 'GTC',
      });

      expect(result.type).toBe('LIMIT');
    });
  });

  describe('cancelFuturesOrder', () => {
    it('should cancel order', async () => {
      mockMethods.cancelOrder.mockResolvedValue({});

      const client = createBinanceFuturesClientForPrices();
      await expect(cancelFuturesOrder(client, 'BTCUSDT', '123')).resolves.not.toThrow();
      expect(mockMethods.cancelOrder).toHaveBeenCalledWith({ symbol: 'BTCUSDT', orderId: 123 });
    });
  });

  describe('cancelAllFuturesOrders', () => {
    it('should cancel all orders for symbol', async () => {
      mockMethods.cancelAllOpenOrders.mockResolvedValue({});

      const client = createBinanceFuturesClientForPrices();
      await expect(cancelAllFuturesOrders(client, 'BTCUSDT')).resolves.not.toThrow();
      expect(mockMethods.cancelAllOpenOrders).toHaveBeenCalledWith({ symbol: 'BTCUSDT' });
    });
  });

  describe('closePosition', () => {
    it('should close long position with sell order', async () => {
      mockMethods.submitNewOrder.mockResolvedValue({
        orderId: '125',
        symbol: 'BTCUSDT',
        status: 'NEW',
        clientOrderId: 'test-id',
        price: 0,
        avgPrice: 0,
        origQty: 0.1,
        executedQty: 0,
        cumQuote: 0,
        timeInForce: 'GTC',
        type: 'MARKET',
        reduceOnly: true,
        closePosition: false,
        side: 'SELL',
        updateTime: Date.now(),
      });

      const client = createBinanceFuturesClientForPrices();
      const result = await closePosition(client, 'BTCUSDT', '0.1');

      expect(result.side).toBe('SELL');
      expect(mockMethods.submitNewOrder).toHaveBeenCalledWith(expect.objectContaining({
        side: 'SELL',
        reduceOnly: 'true',
      }));
    });

    it('should close short position with buy order', async () => {
      mockMethods.submitNewOrder.mockResolvedValue({
        orderId: '126',
        symbol: 'BTCUSDT',
        status: 'NEW',
        clientOrderId: 'test-id',
        price: 0,
        avgPrice: 0,
        origQty: 0.1,
        executedQty: 0,
        cumQuote: 0,
        timeInForce: 'GTC',
        type: 'MARKET',
        reduceOnly: true,
        closePosition: false,
        side: 'BUY',
        updateTime: Date.now(),
      });

      const client = createBinanceFuturesClientForPrices();
      await closePosition(client, 'BTCUSDT', '-0.1');

      expect(mockMethods.submitNewOrder).toHaveBeenCalledWith(expect.objectContaining({
        side: 'BUY',
      }));
    });
  });

  describe('getOpenOrders', () => {
    it('should get open orders for symbol', async () => {
      mockMethods.getAllOpenOrders.mockResolvedValue([
        { orderId: '127', symbol: 'BTCUSDT', status: 'NEW', type: 'LIMIT', side: 'BUY', price: 50000, avgPrice: 0, origQty: 0.1, executedQty: 0, cumQuote: 0, timeInForce: 'GTC', reduceOnly: false, closePosition: false, time: Date.now(), updateTime: Date.now() },
      ]);

      const client = createBinanceFuturesClientForPrices();
      const result = await getOpenOrders(client, 'BTCUSDT');

      expect(result).toHaveLength(1);
      expect(result[0]!.orderId).toBe('127');
    });

    it('should get all open orders when no symbol', async () => {
      mockMethods.getAllOpenOrders.mockResolvedValue([]);

      const client = createBinanceFuturesClientForPrices();
      await getOpenOrders(client);

      expect(mockMethods.getAllOpenOrders).toHaveBeenCalled();
    });
  });

  describe('getSymbolLeverageBrackets', () => {
    it('should get leverage brackets for symbol', async () => {
      mockMethods.getNotionalAndLeverageBrackets.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          brackets: [
            { bracket: 1, initialLeverage: 125, notionalCap: 50000, notionalFloor: 0, maintMarginRatio: 0.004, cum: 0 },
            { bracket: 2, initialLeverage: 100, notionalCap: 250000, notionalFloor: 50000, maintMarginRatio: 0.005, cum: 50 },
          ],
        },
      ]);

      const client = createBinanceFuturesClientForPrices();
      const result = await getSymbolLeverageBrackets(client, 'BTCUSDT');

      expect(result).toHaveLength(2);
      expect(result[0]!.initialLeverage).toBe(125);
    });

    it('should return empty array for unknown symbol', async () => {
      mockMethods.getNotionalAndLeverageBrackets.mockResolvedValue([
        { symbol: 'ETHUSDT', brackets: [] },
      ]);

      const client = createBinanceFuturesClientForPrices();
      const result = await getSymbolLeverageBrackets(client, 'BTCUSDT');

      expect(result).toEqual([]);
    });
  });
});
