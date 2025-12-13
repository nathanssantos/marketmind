import { MainClient } from 'binance';
import { decryptApiKey } from './encryption';
import type { Wallet } from '../db/schema';

export type WalletType = 'live' | 'testnet' | 'paper';

export function isPaperWallet(wallet: Wallet): boolean {
  return wallet.walletType === 'paper' || wallet.apiKeyEncrypted === 'paper-trading';
}

export function getWalletType(wallet: Wallet): WalletType {
  if (wallet.walletType) return wallet.walletType;
  if (wallet.apiKeyEncrypted === 'paper-trading') return 'paper';
  return 'live';
}

export function createBinanceClient(wallet: Wallet): MainClient {
  const walletType = getWalletType(wallet);

  if (walletType === 'paper') {
    throw new Error('Paper wallets cannot execute real orders on Binance');
  }

  const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
  const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

  return new MainClient({
    api_key: apiKey,
    api_secret: apiSecret,
    testnet: walletType === 'testnet',
  });
}

export function createBinanceClientForPrices(): MainClient {
  return new MainClient();
}
