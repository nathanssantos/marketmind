import type { MarketType } from '@marketmind/types';
import { AUTO_TRADING_ORDER } from '../constants';
import type { Wallet } from '../db/schema';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  leverage?: number;
}

export interface OrderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  adjustedQuantity?: number;
  adjustedPrice?: number;
}

export interface ValidationOptions {
  skipBalanceCheck?: boolean;
  skipLeverageCheck?: boolean;
}

const roundToStepSize = (value: number, stepSize: number): number => {
  if (stepSize <= 0) return value;
  const precision = Math.max(0, Math.ceil(-Math.log10(stepSize)));
  const rounded = Math.floor(value / stepSize) * stepSize;
  return parseFloat(rounded.toFixed(precision));
};

const roundToTickSize = (value: number, tickSize: number): number => {
  if (tickSize <= 0) return value;
  const precision = Math.max(0, Math.ceil(-Math.log10(tickSize)));
  const rounded = Math.round(value / tickSize) * tickSize;
  return parseFloat(rounded.toFixed(precision));
};

export const validateOrder = async (
  wallet: Wallet,
  params: OrderParams,
  marketType: MarketType,
  options: ValidationOptions = {}
): Promise<OrderValidation> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let adjustedQuantity = params.quantity;
  let adjustedPrice = params.price;

  try {
    const minNotionalFilter = getMinNotionalFilterService();
    const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
    const filters = symbolFilters.get(params.symbol);

    if (!filters) {
      warnings.push(`No filter data found for ${params.symbol}, using defaults`);
    }

    const minNotional = filters?.minNotional ?? AUTO_TRADING_ORDER.DEFAULT_MIN_NOTIONAL;
    const stepSize = filters?.stepSize ?? 0;
    const tickSize = filters?.tickSize ?? 0;
    const minQty = filters?.minQty ?? 0;

    if (stepSize > 0) {
      const roundedQty = roundToStepSize(params.quantity, stepSize);
      if (roundedQty !== params.quantity) {
        adjustedQuantity = roundedQty;
        warnings.push(`Quantity adjusted from ${params.quantity} to ${roundedQty} (step size: ${stepSize})`);
      }
    }

    if (adjustedQuantity < minQty) {
      errors.push(`Quantity ${adjustedQuantity} is below minimum ${minQty}`);
    }

    if (params.price && tickSize > 0) {
      const roundedPrice = roundToTickSize(params.price, tickSize);
      if (roundedPrice !== params.price) {
        adjustedPrice = roundedPrice;
        warnings.push(`Price adjusted from ${params.price} to ${roundedPrice} (tick size: ${tickSize})`);
      }
    }

    const orderPrice = adjustedPrice ?? 0;
    const notionalValue = adjustedQuantity * orderPrice;
    const requiredNotional = minNotional * AUTO_TRADING_ORDER.MIN_NOTIONAL_BUFFER;

    if (orderPrice > 0 && notionalValue < requiredNotional) {
      errors.push(
        `Order notional ${notionalValue.toFixed(2)} USDT is below minimum ${requiredNotional.toFixed(2)} USDT ` +
        `(minNotional: ${minNotional}, buffer: ${((AUTO_TRADING_ORDER.MIN_NOTIONAL_BUFFER - 1) * 100).toFixed(0)}%)`
      );
    }

    if (!options.skipBalanceCheck) {
      const walletBalance = parseFloat(wallet.currentBalance ?? '0');
      const leverage = params.leverage ?? 1;
      const availableCapital = walletBalance * leverage;
      const marginRequired = notionalValue / leverage;

      if (marginRequired > walletBalance) {
        errors.push(
          `Insufficient balance: required margin ${marginRequired.toFixed(2)} USDT, ` +
          `available ${walletBalance.toFixed(2)} USDT`
        );
      }

      if (notionalValue > availableCapital * 0.95) {
        warnings.push(
          `Order uses ${((notionalValue / availableCapital) * 100).toFixed(1)}% of available capital`
        );
      }
    }

    if (!options.skipLeverageCheck && marketType === 'FUTURES' && params.leverage) {
      const maxLeverage = 125;
      if (params.leverage > maxLeverage) {
        errors.push(`Leverage ${params.leverage}x exceeds maximum ${maxLeverage}x`);
      }
      if (params.leverage > 20) {
        warnings.push(`High leverage (${params.leverage}x) increases liquidation risk`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn({
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        marketType,
        errors,
        warnings,
      }, '[OrderValidator] Order validation failed');
    } else if (warnings.length > 0) {
      logger.trace({
        symbol: params.symbol,
        side: params.side,
        marketType,
        warnings,
      }, '[OrderValidator] Order validated with warnings');
    }

    return {
      isValid,
      errors,
      warnings,
      adjustedQuantity: adjustedQuantity !== params.quantity ? adjustedQuantity : undefined,
      adjustedPrice: adjustedPrice !== params.price ? adjustedPrice : undefined,
    };
  } catch (error) {
    logger.error({
      error,
      symbol: params.symbol,
      marketType,
    }, '[OrderValidator] Error during order validation');

    return {
      isValid: false,
      errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings,
    };
  }
};

export const validateOrderQuick = (
  quantity: number,
  price: number,
  minNotional: number,
  stepSize?: number,
  tickSize?: number,
  minQty?: number
): { isValid: boolean; reason?: string } => {
  if (minQty && quantity < minQty) {
    return { isValid: false, reason: `Quantity ${quantity} below minimum ${minQty}` };
  }

  if (stepSize && stepSize > 0) {
    const remainder = quantity % stepSize;
    if (remainder > 1e-10) {
      return { isValid: false, reason: `Quantity ${quantity} not aligned to step size ${stepSize}` };
    }
  }

  if (tickSize && tickSize > 0) {
    const remainder = price % tickSize;
    if (remainder > 1e-10) {
      return { isValid: false, reason: `Price ${price} not aligned to tick size ${tickSize}` };
    }
  }

  const notional = quantity * price;
  const requiredNotional = minNotional * AUTO_TRADING_ORDER.MIN_NOTIONAL_BUFFER;
  if (notional < requiredNotional) {
    return { isValid: false, reason: `Notional ${notional.toFixed(2)} below minimum ${requiredNotional.toFixed(2)}` };
  }

  return { isValid: true };
};
