import { SecType, OrderAction, OrderType, TimeInForce } from '@stoqey/ib';
import type { Contract, Order } from '@stoqey/ib';
import { IBConnectionManager, getDefaultConnectionManager } from './connection-manager';
import type {
  IBAccountSummary,
  IBMarginImpact,
  MarginSafetyConfig,
  MarginValidationResult,
} from './types';

const DEFAULT_MARGIN_SAFETY_CONFIG: MarginSafetyConfig = {
  minCushion: 0.15,
  maxLeverage: 1.8,
  warnDayTradesRemaining: 2,
  blockWhenMarginCall: true,
};

export class MarginCalculator {
  private connectionManager: IBConnectionManager;
  private config: MarginSafetyConfig;
  private accountSummaryCache: { summary: IBAccountSummary; timestamp: number } | null = null;
  private readonly cacheTtlMs = 30_000;

  constructor(connectionManager?: IBConnectionManager, config?: Partial<MarginSafetyConfig>) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
    this.config = { ...DEFAULT_MARGIN_SAFETY_CONFIG, ...config };
  }

  private createContract(symbol: string): Contract {
    return {
      symbol: symbol.toUpperCase(),
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };
  }

  async getAccountSummary(forceRefresh = false): Promise<IBAccountSummary> {
    if (!forceRefresh && this.accountSummaryCache) {
      if (Date.now() - this.accountSummaryCache.timestamp < this.cacheTtlMs) {
        return this.accountSummaryCache.summary;
      }
    }

    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    const accounts = await this.connectionManager.getManagedAccounts();
    const accountId = accounts[0];

    if (!accountId) {
      throw new Error('No managed accounts found');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout fetching account summary'));
      }, 10_000);

      const tags = [
        'NetLiquidation',
        'BuyingPower',
        'AvailableFunds',
        'ExcessLiquidity',
        'InitMarginReq',
        'MaintMarginReq',
        'EquityWithLoanValue',
        'GrossPositionValue',
        'SMA',
        'Leverage',
        'Cushion',
        'DayTradesRemaining',
        'FullInitMarginReq',
        'FullMaintMarginReq',
        'FullAvailableFunds',
        'FullExcessLiquidity',
      ].join(',');

      const observable = this.connectionManager.client.getAccountSummary('All', tags);

      const subscription = observable.subscribe({
        next: (summaryUpdate) => {
          const summary = this.parseAccountSummary(summaryUpdate.all);
          this.accountSummaryCache = { summary, timestamp: Date.now() };

          clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(summary);
        },
        error: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  private parseAccountSummary(data: unknown): IBAccountSummary {
    const getValue = (key: string): number => {
      if (data && typeof data === 'object') {
        const map = data as Map<string, Map<string, { value: string }>>;
        for (const [, accountData] of map) {
          const tagValue = accountData.get(key);
          if (tagValue?.value) {
            return parseFloat(tagValue.value);
          }
        }
      }
      return 0;
    };

    return {
      netLiquidation: getValue('NetLiquidation'),
      buyingPower: getValue('BuyingPower'),
      availableFunds: getValue('AvailableFunds'),
      excessLiquidity: getValue('ExcessLiquidity'),
      initMarginReq: getValue('InitMarginReq'),
      maintMarginReq: getValue('MaintMarginReq'),
      equityWithLoanValue: getValue('EquityWithLoanValue'),
      grossPositionValue: getValue('GrossPositionValue'),
      sma: getValue('SMA'),
      leverage: getValue('Leverage'),
      cushion: getValue('Cushion'),
      dayTradesRemaining: getValue('DayTradesRemaining'),
      fullInitMarginReq: getValue('FullInitMarginReq'),
      fullMaintMarginReq: getValue('FullMaintMarginReq'),
      fullAvailableFunds: getValue('FullAvailableFunds'),
      fullExcessLiquidity: getValue('FullExcessLiquidity'),
    };
  }

  async calculateMarginImpact(
    symbol: string,
    action: 'BUY' | 'SELL',
    quantity: number,
    limitPrice?: number
  ): Promise<IBMarginImpact> {
    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }

    const contract = this.createContract(symbol);
    const order: Order = {
      action: action === 'BUY' ? OrderAction.BUY : OrderAction.SELL,
      orderType: limitPrice ? OrderType.LMT : OrderType.MKT,
      totalQuantity: quantity,
      lmtPrice: limitPrice,
      tif: TimeInForce.DAY,
      whatIf: true,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error('Timeout calculating margin impact'));
      }, 10_000);

      const subscription = this.connectionManager.client.getOpenOrders().subscribe({
        next: (openOrdersUpdate) => {
          const orders = openOrdersUpdate.all;
          if (!orders || orders.length === 0) return;

          const lastOrder = orders[orders.length - 1];
          if (!lastOrder?.orderState) return;

          const state = lastOrder.orderState;

          if (
            state.initMarginBefore !== undefined ||
            state.commission !== undefined
          ) {
            const toNumber = (val: string | number | undefined): number => {
              if (val === undefined) return 0;
              return typeof val === 'number' ? val : parseFloat(val);
            };

            const impact: IBMarginImpact = {
              initMarginBefore: toNumber(state.initMarginBefore),
              maintMarginBefore: toNumber(state.maintMarginBefore),
              equityWithLoanBefore: toNumber(state.equityWithLoanBefore),
              initMarginChange: toNumber(state.initMarginChange),
              maintMarginChange: toNumber(state.maintMarginChange),
              initMarginAfter: toNumber(state.initMarginAfter),
              maintMarginAfter: toNumber(state.maintMarginAfter),
              equityWithLoanAfter: toNumber(state.equityWithLoanAfter),
              commission: toNumber(state.commission),
              minCommission: toNumber(state.minCommission),
              maxCommission: toNumber(state.maxCommission),
            };

            clearTimeout(timeout);
            subscription.unsubscribe();
            resolve(impact);
          }
        },
        error: (err) => {
          clearTimeout(timeout);
          subscription.unsubscribe();
          reject(err);
        },
      });

      this.connectionManager.client.placeNewOrder(contract, order).catch((err) => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        reject(err);
      });
    });
  }

  validateMarginSafety(account: IBAccountSummary): MarginValidationResult {
    const issues: string[] = [];

    if (account.cushion < this.config.minCushion) {
      issues.push(
        `Cushion ${(account.cushion * 100).toFixed(1)}% below minimum ${this.config.minCushion * 100}%`
      );
    }

    if (account.leverage > this.config.maxLeverage) {
      issues.push(
        `Leverage ${account.leverage.toFixed(2)}x exceeds maximum ${this.config.maxLeverage}x`
      );
    }

    if (account.dayTradesRemaining <= this.config.warnDayTradesRemaining) {
      issues.push(`Only ${account.dayTradesRemaining} day trades remaining (PDT rule)`);
    }

    if (this.config.blockWhenMarginCall && account.excessLiquidity <= 0) {
      issues.push('Account is in margin call - trading blocked');
    }

    const canTrade = account.cushion > 0 && account.availableFunds > 0;

    return {
      safe: issues.length === 0,
      issues,
      canTrade: canTrade && (!this.config.blockWhenMarginCall || account.excessLiquidity > 0),
    };
  }

  async validateTradeMargin(
    symbol: string,
    action: 'BUY' | 'SELL',
    quantity: number,
    limitPrice?: number
  ): Promise<{ valid: boolean; issues: string[]; impact: IBMarginImpact | null }> {
    try {
      const [account, impact] = await Promise.all([
        this.getAccountSummary(),
        this.calculateMarginImpact(symbol, action, quantity, limitPrice),
      ]);

      const issues: string[] = [];

      const marginAfter = account.initMarginReq + impact.initMarginChange;
      const cushionAfter = 1 - marginAfter / account.equityWithLoanValue;

      if (cushionAfter < this.config.minCushion) {
        issues.push(
          `Trade would reduce cushion to ${(cushionAfter * 100).toFixed(1)}% (minimum ${this.config.minCushion * 100}%)`
        );
      }

      if (impact.initMarginAfter > account.availableFunds) {
        issues.push(
          `Insufficient funds: need $${impact.initMarginChange.toFixed(2)}, available $${account.availableFunds.toFixed(2)}`
        );
      }

      const accountValidation = this.validateMarginSafety(account);
      issues.push(...accountValidation.issues);

      return {
        valid: issues.length === 0,
        issues,
        impact,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Error validating margin: ${error instanceof Error ? error.message : 'Unknown error'}`],
        impact: null,
      };
    }
  }

  getEffectiveLeverage(account: IBAccountSummary): number {
    if (account.netLiquidation === 0) return 0;
    return account.grossPositionValue / account.netLiquidation;
  }

  getMarginUtilization(account: IBAccountSummary): number {
    if (account.equityWithLoanValue === 0) return 0;
    return account.initMarginReq / account.equityWithLoanValue;
  }

  getRemainingBuyingPower(account: IBAccountSummary): number {
    return Math.max(0, account.buyingPower);
  }

  updateConfig(config: Partial<MarginSafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MarginSafetyConfig {
    return { ...this.config };
  }

  clearCache(): void {
    this.accountSummaryCache = null;
  }
}

export const marginCalculator = new MarginCalculator();
