import { wallets } from '../../db/schema';

export const WALLET_SAFE_COLUMNS = {
  id: wallets.id,
  name: wallets.name,
  walletType: wallets.walletType,
  marketType: wallets.marketType,
  currency: wallets.currency,
  exchange: wallets.exchange,
  initialBalance: wallets.initialBalance,
  currentBalance: wallets.currentBalance,
  totalWalletBalance: wallets.totalWalletBalance,
  totalDeposits: wallets.totalDeposits,
  totalWithdrawals: wallets.totalWithdrawals,
  isActive: wallets.isActive,
  agentTradingEnabled: wallets.agentTradingEnabled,
  createdAt: wallets.createdAt,
  updatedAt: wallets.updatedAt,
} as const;
