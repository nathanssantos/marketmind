import type { FeeCalculation, TradeViability, TradingFees } from '@marketmind/types';
import { BINANCE_DEFAULT_FEES, TRADING_THRESHOLDS } from '@marketmind/types';

const PERCENTAGE_MULTIPLIER = 100;
const DECIMAL_PLACES = 2;
const BINANCE_COMMISSION_DIVISOR = 10000;
const STANDARD_COMMISSION = 100;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

export class TradingFeeService {
  private fees: TradingFees = {
    makerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_MAKER,
    takerFeeRate: BINANCE_DEFAULT_FEES.VIP_0_TAKER,
    vipLevel: 0,
    hasBNBDiscount: false,
    lastUpdated: Date.now(),
  };

  setFees(fees: Partial<TradingFees>): void {
    this.fees = {
      ...this.fees,
      ...fees,
      lastUpdated: Date.now(),
    };
  }

  getFees(): TradingFees {
    return { ...this.fees };
  }

  private applyBNBDiscount(feeRate: number): number {
    if (!this.fees.hasBNBDiscount) return feeRate;
    return feeRate * (1 - BINANCE_DEFAULT_FEES.BNB_DISCOUNT);
  }

  calculateFees(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    useMakerForEntry = false,
    useMakerForExit = false,
  ): FeeCalculation {
    const entryFeeRate = this.applyBNBDiscount(
      useMakerForEntry ? this.fees.makerFeeRate : this.fees.takerFeeRate,
    );
    const exitFeeRate = this.applyBNBDiscount(
      useMakerForExit ? this.fees.makerFeeRate : this.fees.takerFeeRate,
    );

    const entryValue = entryPrice * quantity;
    const exitValue = exitPrice * quantity;

    const entryFee = entryValue * entryFeeRate;
    const exitFee = exitValue * exitFeeRate;
    const totalFees = entryFee + exitFee;

    const grossProfit = exitValue - entryValue;
    const netProfit = grossProfit - totalFees;

    const feePercentage = (totalFees / entryValue) * PERCENTAGE_MULTIPLIER;
    const netProfitPercentage = (netProfit / entryValue) * PERCENTAGE_MULTIPLIER;

    return {
      entryFee,
      exitFee,
      totalFees,
      feePercentage,
      netProfit,
      netProfitPercentage,
      isProfitableAfterFees: netProfit > 0,
    };
  }

  evaluateTradeViability(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    quantity: number,
  ): TradeViability {
    const risk = Math.abs(entryPrice - stopLoss) * quantity;
    const potentialProfit = Math.abs(takeProfit - entryPrice) * quantity;

    const fees = this.calculateFees(entryPrice, takeProfit, quantity, false, false);

    const expectedProfitAfterFees = fees.netProfit;
    const expectedProfitPercentageAfterFees = fees.netProfitPercentage;

    const riskRewardRatio = potentialProfit / risk;
    const riskRewardRatioAfterFees = expectedProfitAfterFees / risk;

    const positionValue = entryPrice * quantity;

    if (positionValue < TRADING_THRESHOLDS.MIN_POSITION_VALUE) {
      return {
        isViable: false,
        reason: `Position value ($${positionValue.toFixed(DECIMAL_PLACES)}) below minimum ($${TRADING_THRESHOLDS.MIN_POSITION_VALUE})`,
        expectedProfit: potentialProfit,
        expectedProfitAfterFees,
        riskRewardRatio,
        riskRewardRatioAfterFees,
        fees,
      };
    }

    if (expectedProfitPercentageAfterFees < TRADING_THRESHOLDS.MIN_PROFIT_AFTER_FEES * PERCENTAGE_MULTIPLIER) {
      return {
        isViable: false,
        reason: `Expected profit after fees (${expectedProfitPercentageAfterFees.toFixed(DECIMAL_PLACES)}%) below minimum (${(TRADING_THRESHOLDS.MIN_PROFIT_AFTER_FEES * PERCENTAGE_MULTIPLIER).toFixed(DECIMAL_PLACES)}%)`,
        expectedProfit: potentialProfit,
        expectedProfitAfterFees,
        riskRewardRatio,
        riskRewardRatioAfterFees,
        fees,
      };
    }

    if (riskRewardRatioAfterFees < TRADING_THRESHOLDS.MIN_RISK_REWARD_AFTER_FEES) {
      return {
        isViable: false,
        reason: `Risk:Reward after fees (${riskRewardRatioAfterFees.toFixed(DECIMAL_PLACES)}:1) below minimum (${TRADING_THRESHOLDS.MIN_RISK_REWARD_AFTER_FEES}:1)`,
        expectedProfit: potentialProfit,
        expectedProfitAfterFees,
        riskRewardRatio,
        riskRewardRatioAfterFees,
        fees,
      };
    }

    if (!fees.isProfitableAfterFees) {
      return {
        isViable: false,
        reason: 'Trade would be unprofitable after fees',
        expectedProfit: potentialProfit,
        expectedProfitAfterFees,
        riskRewardRatio,
        riskRewardRatioAfterFees,
        fees,
      };
    }

    return {
      isViable: true,
      expectedProfit: potentialProfit,
      expectedProfitAfterFees,
      riskRewardRatio,
      riskRewardRatioAfterFees,
      fees,
    };
  }

  async fetchBinanceFees(apiKey: string, apiSecret: string): Promise<TradingFees | null> {
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;

      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

      const response = await fetch(
        `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': apiKey,
          },
        },
      );

      if (!response.ok) {
        console.error('[TradingFeeService] Failed to fetch Binance fees:', response.statusText);
        return null;
      }

      const data = await response.json() as {
        makerCommission: number;
        takerCommission: number;
        canTrade: boolean;
      };

      const fees: TradingFees = {
        makerFeeRate: data.makerCommission / BINANCE_COMMISSION_DIVISOR,
        takerFeeRate: data.takerCommission / BINANCE_COMMISSION_DIVISOR,
        vipLevel: this.calculateVIPLevel(data.makerCommission),
        hasBNBDiscount: data.makerCommission < STANDARD_COMMISSION,
        lastUpdated: Date.now(),
      };

      this.setFees(fees);
      return fees;
    } catch (error) {
      console.error('[TradingFeeService] Error fetching Binance fees:', error);
      return null;
    }
  }

  private calculateVIPLevel(makerCommission: number): number {
    const vipLevels = [
      { commission: 100, level: 0 },
      { commission: 90, level: 1 },
      { commission: 80, level: 2 },
      { commission: 60, level: 3 },
      { commission: 40, level: 4 },
      { commission: 20, level: 5 },
      { commission: 12, level: 6 },
      { commission: 10, level: 7 },
      { commission: 8, level: 8 },
      { commission: 4, level: 9 },
    ];

    const match = vipLevels.find((v) => v.commission === makerCommission);
    return match?.level ?? 0;
  }

  shouldFetchNewFees(): boolean {
    const CACHE_DURATION = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
    return Date.now() - this.fees.lastUpdated > CACHE_DURATION;
  }
}

export const tradingFeeService = new TradingFeeService();
