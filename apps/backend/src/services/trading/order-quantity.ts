import type { MarketType } from '@marketmind/types';
import { TRPCError } from '@trpc/server';
import type { WalletRecord } from '../database/walletQueries';
import { isPaperWallet } from '../binance-client';
import { createBinanceFuturesClient, getConfiguredLeverage, LeverageUnavailableError } from '../binance-futures-client';
import { createBinanceClient } from '../binance-client';
import { guardBinanceCall } from '../binance-api-cache';
import { getMinNotionalFilterService } from '../min-notional-filter';
import { formatQuantityForBinance } from '../../utils/formatters';
import { logger } from '../logger';

export interface CalculateQtyInput {
  wallet: WalletRecord;
  symbol: string;
  marketType: MarketType;
  percent: number;
  price: number;
}

export interface CalculateQtyResult {
  quantity: string;
  notional: number;
  marginUsed: number;
  leverage: number;
  balance: number;
}

export async function calculateQtyFromPercent(input: CalculateQtyInput): Promise<CalculateQtyResult> {
  const { wallet, symbol, marketType, percent, price } = input;

  if (percent <= 0 || percent > 100) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid percent: ${percent}. Must be between 0 and 100.`,
    });
  }

  if (price <= 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid price: ${price}. Must be positive.`,
    });
  }

  const pct = percent / 100;
  const filtersMap = await getMinNotionalFilterService().getSymbolFilters(marketType);
  const filters = filtersMap.get(symbol);
  const stepSize = filters?.stepSize?.toString();

  let balance: number;
  let leverage: number;

  if (isPaperWallet(wallet)) {
    balance = parseFloat(wallet.currentBalance ?? '0');
    leverage = 1;
  } else if (marketType === 'FUTURES') {
    const client = createBinanceFuturesClient(wallet);

    // V3 dropped the leverage field from accountInfoV3.positions. Use
    // the canonical helper that pulls from /fapi/v1/symbolConfig with
    // a defensive notional/initialMargin fallback. If neither yields a
    // usable value the helper throws LeverageUnavailableError — refuse
    // to size from a default 1× because that silently produces a
    // tiny order (95% × 15× intent → 95% × 1× = 6.3% of intended
    // notional in scalp scenarios).
    const accountInfo = await guardBinanceCall(() => client.getAccountInformationV3());

    balance = parseFloat(String(accountInfo.availableBalance ?? '0'));
    if (balance <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `No available balance on wallet ${wallet.name}.`,
      });
    }

    try {
      leverage = await getConfiguredLeverage(client, symbol);
    } catch (error) {
      if (error instanceof LeverageUnavailableError) {
        logger.error({ symbol, walletId: wallet.id }, 'Refusing to size order — leverage unavailable for symbol');
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Could not read leverage for ${symbol}. Open the leverage popover to set it explicitly, then retry.`,
        });
      }
      throw error;
    }
  } else {
    const client = createBinanceClient(wallet);
    const accountInfo = await guardBinanceCall(() => client.getAccountInformation());
    const usdt = accountInfo.balances?.find((b) => b.asset === 'USDT');
    balance = usdt?.free ? parseFloat(String(usdt.free)) : 0;
    leverage = 1;
  }

  const marginPower = balance * leverage;
  const rawQty = (marginPower * pct) / price;
  const quantity = formatQuantityForBinance(rawQty, stepSize);
  const qtyNum = parseFloat(quantity);
  const notional = qtyNum * price;
  const marginUsed = notional / leverage;

  const minNotional = filters?.minNotional ?? 5;
  if (notional < minNotional) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Order notional ($${notional.toFixed(2)}) is below minimum $${minNotional} for ${symbol}. Increase position size % or deposit more funds.`,
    });
  }

  return { quantity, notional, marginUsed, leverage, balance };
}
