import { TRPCError } from '@trpc/server';
import type { WalletRecord } from '../database/walletQueries';
import { isPaperWallet } from '../binance-client';
import { createBinanceFuturesClient } from '../binance-futures-client';
import { createBinanceClient } from '../binance-client';
import { guardBinanceCall } from '../binance-api-cache';
import { getMinNotionalFilterService } from '../min-notional-filter';
import { formatQuantityForBinance } from '../../utils/formatters';
import { logger } from '../logger';

export interface CalculateQtyInput {
  wallet: WalletRecord;
  symbol: string;
  marketType: 'SPOT' | 'FUTURES';
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

  let balance = 0;
  let leverage = 1;

  if (isPaperWallet(wallet)) {
    balance = parseFloat(wallet.currentBalance ?? '0');
    leverage = 1;
  } else if (marketType === 'FUTURES') {
    const client = createBinanceFuturesClient(wallet);

    const [accountInfo, positions] = await Promise.all([
      guardBinanceCall(() => client.getAccountInformation()),
      guardBinanceCall(() => client.getPositions({ symbol })).catch(() => []),
    ]);

    balance = parseFloat(String(accountInfo.availableBalance ?? '0'));
    if (balance <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `No available balance on wallet ${wallet.name}.`,
      });
    }

    const symbolPos = positions.find((p) => p.symbol === symbol);
    if (symbolPos && Number(symbolPos.leverage) > 0) {
      leverage = Number(symbolPos.leverage);
    } else {
      const acctPos = accountInfo.positions?.find((p) => p.symbol === symbol);
      if (acctPos && Number(acctPos.leverage) > 0) {
        leverage = Number(acctPos.leverage);
      } else {
        logger.warn({ symbol, walletId: wallet.id }, 'Could not determine live leverage — falling back to 1x');
        leverage = 1;
      }
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
