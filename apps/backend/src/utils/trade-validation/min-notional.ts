import { TRADING_DEFAULTS } from '@marketmind/types';
import type { MinNotionalInput, TradeValidationResult } from './types';

export const validateMinNotional = (input: MinNotionalInput): TradeValidationResult => {
  const { positionValue, minTradeValueUsd = TRADING_DEFAULTS.MIN_TRADE_VALUE_USD } = input;

  if (positionValue < minTradeValueUsd) {
    return {
      isValid: false,
      reason: `Position value ${positionValue.toFixed(2)} USD below minimum ${minTradeValueUsd} USD`,
    };
  }

  return { isValid: true };
};
