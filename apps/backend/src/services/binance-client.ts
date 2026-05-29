import type { LogParams } from 'binance';
import { MainClient, USDMClient } from 'binance';
import type { WalletType } from '@marketmind/types';
import { decryptApiKey } from './encryption';
import type { Wallet } from '../db/schema';
import { applyBinanceTimeOffset } from './binance-time-sync';

export type { WalletType };

interface AuthedClientOptions {
  api_key: string;
  api_secret: string;
  testnet: boolean;
  // Always true: the process-wide binance-time-sync singleton owns clock
  // correction (one shared `/time` poll), so individual clients must NOT
  // spin up their own per-instance sync timer.
  disableTimeSync: true;
}

const buildAuthedOptions = (wallet: Wallet, action: string): AuthedClientOptions => {
  const walletType = getWalletType(wallet);
  if (walletType === 'paper') {
    throw new Error(`Paper wallets cannot ${action} on Binance`);
  }
  return {
    api_key: decryptApiKey(wallet.apiKeyEncrypted),
    api_secret: decryptApiKey(wallet.apiSecretEncrypted),
    testnet: walletType === 'testnet',
    disableTimeSync: true,
  };
};

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
  const client = new MainClient(buildAuthedOptions(wallet, 'execute real orders'));
  applyBinanceTimeOffset(client);
  return client;
}

export function createBinanceFuturesClient(wallet: Wallet): USDMClient {
  const client = new USDMClient(buildAuthedOptions(wallet, 'execute real orders'));
  applyBinanceTimeOffset(client);
  return client;
}

export function createBinanceClientForPrices(): MainClient {
  // Public endpoints aren't signed, so the offset is irrelevant here —
  // but applying it is harmless and keeps every client uniform.
  return new MainClient({ disableTimeSync: true });
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  return new USDMClient({ disableTimeSync: true });
}
