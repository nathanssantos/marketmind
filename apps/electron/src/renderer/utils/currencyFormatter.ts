import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY } from '@marketmind/types';

export const getCurrencySymbol = (currency: string = DEFAULT_CURRENCY): string =>
  CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] ?? '$';

export const formatWalletCurrency = (value: number, currency: string = DEFAULT_CURRENCY): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${Math.abs(value).toFixed(2)}`;
};

export const formatWalletCurrencyWithSign = (value: number, currency: string = DEFAULT_CURRENCY): string => {
  const symbol = getCurrencySymbol(currency);
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${symbol}${Math.abs(value).toFixed(2)}`;
};

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatBRL = (value: number): string => brlFormatter.format(value);

export const formatBRLCompact = (value: number): string => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(2)}K`;
  return formatBRL(value);
};
