import { MainClient, USDMClient } from 'binance';
import { decryptApiKey } from './encryption';
import { logger, serializeError } from './logger';
import type { Wallet } from '../db/schema';
import type { MarketType, FeeOrderType, MarketFees } from '@marketmind/types';
import { BINANCE_FEES, getDefaultFee, applyBnbDiscount } from '@marketmind/types';
import { TIME_MS } from '../constants';

export interface CachedFees {
  spot: MarketFees;
  futures: MarketFees;
  vipLevel: number;
  hasBnbDiscount: boolean;
  lastUpdated: Date;
}

interface FeeCache {
  fees: CachedFees;
  expiresAt: number;
}

const CACHE_DURATION_MS = TIME_MS.DAY;

const feeCache = new Map<string, FeeCache>();

export const getDefaultFees = (): CachedFees => ({
  spot: { ...BINANCE_FEES.SPOT.VIP_0 },
  futures: { ...BINANCE_FEES.FUTURES.VIP_0 },
  vipLevel: 0,
  hasBnbDiscount: false,
  lastUpdated: new Date(),
});

export const getCachedFees = (walletId: string): CachedFees | null => {
  const cached = feeCache.get(walletId);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    feeCache.delete(walletId);
    return null;
  }
  return cached.fees;
};

const MAX_FEE_CACHE_SIZE = 100;

export const setCachedFees = (walletId: string, fees: CachedFees): void => {
  if (feeCache.size >= MAX_FEE_CACHE_SIZE) {
    const firstKey = feeCache.keys().next().value;
    if (firstKey) feeCache.delete(firstKey);
  }
  feeCache.set(walletId, {
    fees,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });
};

export const clearFeeCache = (walletId?: string): void => {
  if (walletId !== undefined) {
    feeCache.delete(walletId);
  } else {
    feeCache.clear();
  }
};

export const fetchSpotFees = async (wallet: Wallet): Promise<MarketFees> => {
  if (wallet.walletType === 'paper' || wallet.apiKeyEncrypted === 'paper-trading') {
    return { ...BINANCE_FEES.SPOT.VIP_0 };
  }

  try {
    const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

    const client = new MainClient({
      api_key: apiKey,
      api_secret: apiSecret,
      testnet: wallet.walletType === 'testnet',
    });

    const feeInfo = await client.getTradeFee({ symbol: 'BTCUSDT' });

    const firstFee = feeInfo?.[0];
    if (firstFee?.makerCommission && firstFee?.takerCommission) {
      return {
        maker: Number(firstFee.makerCommission),
        taker: Number(firstFee.takerCommission),
      };
    }

    return { ...BINANCE_FEES.SPOT.VIP_0 };
  } catch (error) {
    logger.warn(
      { error: serializeError(error), walletId: wallet.id },
      '[FeeService] Failed to fetch spot fees, using defaults'
    );
    return { ...BINANCE_FEES.SPOT.VIP_0 };
  }
};

export const fetchFuturesFees = async (wallet: Wallet): Promise<MarketFees> => {
  if (wallet.walletType === 'paper' || wallet.apiKeyEncrypted === 'paper-trading') {
    return { ...BINANCE_FEES.FUTURES.VIP_0 };
  }

  try {
    const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

    const client = new USDMClient({
      api_key: apiKey,
      api_secret: apiSecret,
      testnet: wallet.walletType === 'testnet',
    });

    const commissionRate = await client.getAccountCommissionRate({ symbol: 'BTCUSDT' });

    return {
      maker: Number(commissionRate.makerCommissionRate),
      taker: Number(commissionRate.takerCommissionRate),
    };
  } catch (error) {
    logger.warn(
      { error: serializeError(error), walletId: wallet.id },
      '[FeeService] Failed to fetch futures fees, using defaults'
    );
    return { ...BINANCE_FEES.FUTURES.VIP_0 };
  }
};

export const fetchAllFees = async (wallet: Wallet): Promise<CachedFees> => {
  const cached = getCachedFees(wallet.id);
  if (cached) return cached;

  const [spot, futures] = await Promise.all([
    fetchSpotFees(wallet),
    fetchFuturesFees(wallet),
  ]);

  const fees: CachedFees = {
    spot,
    futures,
    vipLevel: 0,
    hasBnbDiscount: false,
    lastUpdated: new Date(),
  };

  setCachedFees(wallet.id, fees);

  logger.info(
    {
      walletId: wallet.id,
      spot: { maker: spot.maker * 100, taker: spot.taker * 100 },
      futures: { maker: futures.maker * 100, taker: futures.taker * 100 },
    },
    '[FeeService] Fetched and cached trading fees (%)'
  );

  return fees;
};

export const getEffectiveFee = (
  marketType: MarketType,
  orderType: FeeOrderType = 'TAKER',
  cachedFees?: CachedFees | null
): number => {
  if (!cachedFees) {
    return getDefaultFee(marketType, orderType);
  }

  const fees = marketType === 'FUTURES' ? cachedFees.futures : cachedFees.spot;
  const baseFee = orderType === 'MAKER' ? fees.maker : fees.taker;

  return cachedFees.hasBnbDiscount ? applyBnbDiscount(baseFee) : baseFee;
};

export const getBacktestFee = (
  marketType: MarketType,
  orderType: FeeOrderType = 'TAKER',
  useBnbDiscount = false
): number => {
  const baseFee = getDefaultFee(marketType, orderType);
  return useBnbDiscount ? applyBnbDiscount(baseFee) : baseFee;
};

export const calculateTradeFees = (
  positionValue: number,
  marketType: MarketType,
  orderType: FeeOrderType = 'TAKER',
  cachedFees?: CachedFees | null
): { entryFee: number; exitFee: number; totalFees: number; feePercent: number } => {
  const feeRate = getEffectiveFee(marketType, orderType, cachedFees);
  const entryFee = positionValue * feeRate;
  const exitFee = positionValue * feeRate;
  const totalFees = entryFee + exitFee;

  return {
    entryFee,
    exitFee,
    totalFees,
    feePercent: feeRate * 2 * 100,
  };
};

export const FeeService = {
  getDefaultFees,
  getCachedFees,
  setCachedFees,
  clearFeeCache,
  fetchSpotFees,
  fetchFuturesFees,
  fetchAllFees,
  getEffectiveFee,
  getBacktestFee,
  calculateTradeFees,
};

export default FeeService;
