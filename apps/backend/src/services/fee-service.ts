import { getFuturesClient, getSpotClient } from '../exchange';
import { logger, serializeError } from './logger';
import type { Wallet } from '../db/schema';
import type { MarketType, FeeOrderType, MarketFees } from '@marketmind/types';
import { BINANCE_FEES, getDefaultFee, applyBnbDiscount, getFeeRateForVipLevel } from '@marketmind/types';
import { TIME_MS } from '../constants';

const MIN_BNB_FOR_DISCOUNT = 0.001;

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
    const client = getSpotClient(wallet);
    const fees = await client.getTradeFees('BTCUSDT');

    const firstFee = fees?.[0];
    if (firstFee?.makerCommission && firstFee?.takerCommission) {
      return {
        maker: firstFee.makerCommission,
        taker: firstFee.takerCommission,
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

interface FuturesAccountInfo {
  fees: MarketFees;
  vipLevel: number;
  hasBnbDiscount: boolean;
}

export const fetchFuturesFeesWithAccountInfo = async (wallet: Wallet): Promise<FuturesAccountInfo> => {
  const defaultResult: FuturesAccountInfo = {
    fees: { ...BINANCE_FEES.FUTURES.VIP_0 },
    vipLevel: 0,
    hasBnbDiscount: false,
  };

  if (wallet.walletType === 'paper' || wallet.apiKeyEncrypted === 'paper-trading') {
    return defaultResult;
  }

  try {
    const client = getFuturesClient(wallet);

    const [commissionRate, accountInfo] = await Promise.all([
      client.getCommissionRate(),
      client.getAccountInfo(),
    ]);

    const bnbAsset = accountInfo.assets.find(a => a.asset === 'BNB');
    const bnbBalance = bnbAsset ? parseFloat(String(bnbAsset.walletBalance)) : 0;
    const hasBnbDiscount = bnbBalance >= MIN_BNB_FOR_DISCOUNT;

    return {
      fees: {
        maker: commissionRate.makerCommissionRate,
        taker: commissionRate.takerCommissionRate,
      },
      vipLevel: Number(accountInfo.feeTier),
      hasBnbDiscount,
    };
  } catch (error) {
    logger.warn(
      { error: serializeError(error), walletId: wallet.id },
      '[FeeService] Failed to fetch futures account info, using defaults'
    );
    return defaultResult;
  }
};

export const fetchFuturesFees = async (wallet: Wallet): Promise<MarketFees> => {
  const result = await fetchFuturesFeesWithAccountInfo(wallet);
  return result.fees;
};

export const fetchAllFees = async (wallet: Wallet): Promise<CachedFees> => {
  const cached = getCachedFees(wallet.id);
  if (cached) return cached;

  const [spot, futuresAccountInfo] = await Promise.all([
    fetchSpotFees(wallet),
    fetchFuturesFeesWithAccountInfo(wallet),
  ]);

  const fees: CachedFees = {
    spot,
    futures: futuresAccountInfo.fees,
    vipLevel: futuresAccountInfo.vipLevel,
    hasBnbDiscount: futuresAccountInfo.hasBnbDiscount,
    lastUpdated: new Date(),
  };

  setCachedFees(wallet.id, fees);

  logger.info(
    {
      walletId: wallet.id,
      vipLevel: fees.vipLevel,
      hasBnbDiscount: fees.hasBnbDiscount,
      spot: { maker: spot.maker * 100, taker: spot.taker * 100 },
      futures: { maker: futuresAccountInfo.fees.maker * 100, taker: futuresAccountInfo.fees.taker * 100 },
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
  useBnbDiscount = false,
  vipLevel = 0
): number => {
  const baseFee = getFeeRateForVipLevel(marketType, vipLevel, orderType);
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
  fetchFuturesFeesWithAccountInfo,
  fetchAllFees,
  getEffectiveFee,
  getBacktestFee,
  calculateTradeFees,
};

export default FeeService;
