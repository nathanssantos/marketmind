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

/** Raw credentials for the wallet-creation validation path (no persisted
 *  wallet row exists yet). Everything else uses {@link createBinanceClient}
 *  / {@link createBinanceFuturesClient} with a {@link Wallet}. */
export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
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

const credentialOptions = (creds: BinanceCredentials): AuthedClientOptions => ({
  api_key: creds.apiKey,
  api_secret: creds.apiSecret,
  testnet: creds.testnet,
  disableTimeSync: true,
});

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

/** Authed spot client from raw credentials — wallet-creation validation
 *  (no persisted {@link Wallet} row exists yet). Applies the time offset
 *  so the validation call doesn't -1021 on a skewed clock. */
export function createBinanceSpotClientFromCredentials(creds: BinanceCredentials): MainClient {
  const client = new MainClient(credentialOptions(creds));
  applyBinanceTimeOffset(client);
  return client;
}

/** Authed futures client from raw credentials. See
 *  {@link createBinanceSpotClientFromCredentials}. Also the single
 *  construction path for the exchange-abstraction layer
 *  (`exchange/binance/*`), so those clients get the offset too. */
export function createBinanceFuturesClientFromCredentials(creds: BinanceCredentials): USDMClient {
  const client = new USDMClient(credentialOptions(creds));
  applyBinanceTimeOffset(client);
  return client;
}

export function createBinanceClientForPrices(): MainClient {
  // Public endpoints aren't signed, so the offset is irrelevant — but we
  // apply it anyway so every client in the app is uniform (and any future
  // signed call on this instance is safe).
  const client = new MainClient({ disableTimeSync: true });
  applyBinanceTimeOffset(client);
  return client;
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  const client = new USDMClient({ disableTimeSync: true });
  applyBinanceTimeOffset(client);
  return client;
}
