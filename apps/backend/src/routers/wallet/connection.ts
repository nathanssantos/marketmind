import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { STABLECOINS } from '../../constants';
import { wallets } from '../../db/schema';
import { createBinanceClient, createBinanceFuturesClient, isPaperWallet } from '../../services/binance-client';
import { getFuturesClient } from '../../exchange';
import { protectedProcedure, router } from '../../trpc';

export const walletConnectionRouter = router({
  testConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (isPaperWallet(wallet)) {
        return {
          connected: true,
          walletType: 'paper' as const,
          message: 'Paper wallet - no API connection needed',
        };
      }

      try {
        if (wallet.exchange === 'INTERACTIVE_BROKERS') {
          const net = await import('net');
          const { IB_DEFAULT_HOST, IB_PORTS } = await import('../../exchange/interactive-brokers/constants');
          const port = wallet.walletType === 'live' ? IB_PORTS.GATEWAY_LIVE : IB_PORTS.GATEWAY_PAPER;

          const connected = await new Promise<boolean>((resolve) => {
            const socket = net.createConnection({ host: IB_DEFAULT_HOST, port, timeout: 3000 });
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('error', () => { socket.destroy(); resolve(false); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
          });

          return {
            connected,
            walletType: wallet.walletType,
            marketType: wallet.marketType,
            serverTime: connected ? Date.now() : undefined,
            ...(!connected && { error: 'IB Gateway not reachable' }),
          };
        }

        let serverTime: number;

        if (wallet.marketType === 'FUTURES') {
          const client = createBinanceFuturesClient(wallet);
          serverTime = await client.getServerTime();
        } else {
          const client = createBinanceClient(wallet);
          await client.testConnectivity();
          serverTime = Number(await client.getServerTime());
        }

        return {
          connected: true,
          walletType: wallet.walletType,
          marketType: wallet.marketType,
          serverTime,
        };
      } catch (error) {
        return {
          connected: false,
          walletType: wallet.walletType,
          marketType: wallet.marketType,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  getPortfolio: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [wallet] = await ctx.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, input.id), eq(wallets.userId, ctx.user.id)))
        .limit(1);

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (isPaperWallet(wallet)) {
        return {
          totalValueUSDT: wallet.currentBalance ?? '0',
          walletType: 'paper' as const,
          assets: [
            {
              asset: 'USDT',
              free: wallet.currentBalance ?? '0',
              locked: '0',
              valueUSDT: wallet.currentBalance ?? '0',
            },
          ],
        };
      }

      try {
        let totalValueUSDT = 0;
        let realizedBalanceUSDT = 0;
        let assets: Array<{ asset: string; free: string; locked: string; valueUSDT: string }> = [];

        if (wallet.marketType === 'FUTURES') {
          const client = getFuturesClient(wallet);
          const accountInfo = await client.getAccountInfo();

          const nonZeroAssets = accountInfo.assets?.filter((a) => {
            const balance = parseFloat(String(a.walletBalance || '0'));
            return balance > 0;
          }) || [];

          for (const asset of nonZeroAssets) {
            const assetWalletBalance = parseFloat(String(asset.walletBalance || '0'));
            const availableBalance = parseFloat(String(asset.availableBalance || '0'));
            const marginBalance = parseFloat(String(asset.marginBalance || '0'));

            if (asset.asset === 'USDT') {
              totalValueUSDT += marginBalance;
              realizedBalanceUSDT += assetWalletBalance;
            }

            assets.push({
              asset: asset.asset,
              free: availableBalance.toString(),
              locked: (assetWalletBalance - availableBalance).toFixed(2),
              valueUSDT: marginBalance.toFixed(2),
            });
          }
        } else {
          const client = createBinanceClient(wallet);
          const accountInfo = await client.getAccountInformation();

          const nonZeroBalances = accountInfo.balances?.filter((b) => {
            const free = parseFloat(b.free?.toString() || '0');
            const locked = parseFloat(b.locked?.toString() || '0');
            return free > 0 || locked > 0;
          }) || [];

          const assetsWithValue = await Promise.all(
            nonZeroBalances.map(async (balance) => {
              const free = parseFloat(balance.free?.toString() || '0');
              const locked = parseFloat(balance.locked?.toString() || '0');
              const total = free + locked;

              let valueUSDT = 0;

              if (STABLECOINS.includes(balance.asset as typeof STABLECOINS[number])) {
                valueUSDT = total;
              } else {
                try {
                  const ticker = await client.get24hrChangeStatistics({
                    symbol: `${balance.asset}USDT`,
                  });
                  const price = parseFloat(ticker.lastPrice || '0');
                  valueUSDT = total * price;
                } catch {
                  try {
                    const btcTicker = await client.get24hrChangeStatistics({
                      symbol: `${balance.asset}BTC`,
                    });
                    const btcUsdtTicker = await client.get24hrChangeStatistics({
                      symbol: 'BTCUSDT',
                    });
                    const btcPrice = parseFloat(btcTicker.lastPrice || '0');
                    const btcUsdtPrice = parseFloat(btcUsdtTicker.lastPrice || '0');
                    valueUSDT = total * btcPrice * btcUsdtPrice;
                  } catch {
                    valueUSDT = 0;
                  }
                }
              }

              totalValueUSDT += valueUSDT;

              return {
                asset: balance.asset,
                free: free.toString(),
                locked: locked.toString(),
                valueUSDT: valueUSDT.toFixed(2),
              };
            })
          );

          assets = assetsWithValue;
          realizedBalanceUSDT = totalValueUSDT;
        }

        const sortedAssets = assets.sort(
          (a, b) => parseFloat(b.valueUSDT) - parseFloat(a.valueUSDT)
        );

        await ctx.db
          .update(wallets)
          .set({
            currentBalance: realizedBalanceUSDT.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, input.id));

        return {
          totalValueUSDT: totalValueUSDT.toFixed(2),
          realizedBalance: realizedBalanceUSDT.toFixed(2),
          walletType: wallet.walletType,
          marketType: wallet.marketType,
          assets: sortedAssets,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch portfolio from Binance ${wallet.walletType} ${wallet.marketType}: ${errorMessage}`,
          cause: error,
        });
      }
    }),
});
