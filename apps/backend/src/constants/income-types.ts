export const INCOME_TYPES = [
  'REALIZED_PNL',
  'COMMISSION',
  'FUNDING_FEE',
  'TRANSFER',
  'INSURANCE_CLEAR',
  'WELCOME_BONUS',
  'REFERRAL_KICKBACK',
  'COMMISSION_REBATE',
  'API_REBATE',
  'CONTEST_REWARD',
  'CROSS_COLLATERAL_TRANSFER',
  'OPTIONS_PREMIUM_FEE',
  'OPTIONS_SETTLE_PROFIT',
  'INTERNAL_TRANSFER',
  'AUTO_EXCHANGE',
  'DELIVERED_SETTELMENT',
  'COIN_SWAP_DEPOSIT',
  'COIN_SWAP_WITHDRAW',
  'PAPER_SYNTH',
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

export const PNL_CONTRIBUTING_TYPES = ['REALIZED_PNL', 'COMMISSION', 'FUNDING_FEE'] as const;

export type PnlContributingType = (typeof PNL_CONTRIBUTING_TYPES)[number];

export const INCOME_SOURCES = ['binance', 'paper', 'manual'] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const isPnlContributing = (type: IncomeType): type is PnlContributingType =>
  (PNL_CONTRIBUTING_TYPES as readonly string[]).includes(type);
