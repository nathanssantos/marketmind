import type { LogParams } from 'binance';
import { MainClient, USDMClient } from 'binance';
import type { WalletType } from '@marketmind/types';
import { decryptApiKey } from './encryption';
import type { Wallet } from '../db/schema';

export type { WalletType };

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
    disableTimeSync: true,
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
    disableTimeSync: true,
  });
}

export function createBinanceClientForPrices(): MainClient {
  return new MainClient({ disableTimeSync: true });
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  return new USDMClient({ disableTimeSync: true });
}
