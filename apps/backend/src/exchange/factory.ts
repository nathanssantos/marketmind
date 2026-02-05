import type { Wallet } from '../db/schema';
import { decryptApiKey } from '../services/encryption';
import { getWalletType } from '../services/binance-client';
import type { ExchangeCredentials, ExchangeId } from './types';
import type { IExchangeFuturesClient } from './futures-client';
import type { IExchangeSpotClient } from './spot-client';
import { exchangeRegistry } from './exchange-registry';
import { BinanceExchangeProvider } from './binance';
import { IBExchangeProvider } from './interactive-brokers';

const DEFAULT_EXCHANGE_ID: ExchangeId = 'BINANCE';

exchangeRegistry.register(new BinanceExchangeProvider());
exchangeRegistry.register(new IBExchangeProvider());

export function getExchangeCredentials(wallet: Wallet): ExchangeCredentials {
  const walletType = getWalletType(wallet);
  if (walletType === 'paper') throw new Error('Paper wallets cannot execute real exchange orders');

  return {
    apiKey: decryptApiKey(wallet.apiKeyEncrypted),
    apiSecret: decryptApiKey(wallet.apiSecretEncrypted),
    testnet: walletType === 'testnet',
  };
}

export function getExchangeId(wallet: Wallet): ExchangeId {
  return (wallet.exchange as ExchangeId) ?? DEFAULT_EXCHANGE_ID;
}

export function getFuturesClient(wallet: Wallet): IExchangeFuturesClient {
  const exchangeId = getExchangeId(wallet);
  const provider = exchangeRegistry.get(exchangeId);
  return provider.createFuturesClient(getExchangeCredentials(wallet));
}

export function getSpotClient(wallet: Wallet): IExchangeSpotClient {
  const exchangeId = getExchangeId(wallet);
  const provider = exchangeRegistry.get(exchangeId);
  return provider.createSpotClient(getExchangeCredentials(wallet));
}
