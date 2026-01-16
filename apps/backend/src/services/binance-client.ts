import type { LogParams } from 'binance';
import { MainClient, USDMClient } from 'binance';
import { decryptApiKey } from './encryption';
import type { Wallet } from '../db/schema';

export type WalletType = 'live' | 'testnet' | 'paper';

const noop = (): void => {};

export const silentWsLogger = {
  silly: noop,
  debug: noop,
  notice: noop,
  info: noop,
  warning: noop,
  error: noop,
  trace: noop,
} satisfies LogParams & { trace: () => void };

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
    disableTimeSync: false,
  });
}

export function createBinanceFuturesClient(wallet: Wallet): USDMClient {
  const walletType = getWalletType(wallet);

  if (walletType === 'paper') {
    throw new Error('Paper wallets cannot execute real orders on Binance Futures');
  }

  const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
  const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

  return new USDMClient({
    api_key: apiKey,
    api_secret: apiSecret,
    testnet: walletType === 'testnet',
    disableTimeSync: false,
  });
}

export function createBinanceClientForPrices(): MainClient {
  return new MainClient();
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  return new USDMClient();
}
