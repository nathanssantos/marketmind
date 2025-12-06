import type { Kline } from '@marketmind/types';
import type { BacktestConfig, BacktestTrade } from '@marketmind/types';
import { RiskManagementService } from '../risk/RiskManagementService';
import type { SetupDetectorResult } from '../setupDetection';

export class BacktestExecutor {
  openPosition(
    setup: SetupDetectorResult['setup'],
    entryKline: Kline,
    currentEquity: number,
    config: BacktestConfig,
    riskProfile?: 'conservative' | 'moderate' | 'aggressive',
    historicalKlines?: Kline[]
  ): BacktestTrade | null {
    if (!setup) return null;

    let positionValue: number;
    
    if (config.useKellyCriterion && riskProfile && historicalKlines) {
      const positionSizingRequest = {
        winRate: 0.55,
        avgWin: 100,
        avgLoss: 50,
        capital: currentEquity,
        klines: historicalKlines,
        currentPositions: [],
      };
      
      const result = RiskManagementService.calculatePositionSize(positionSizingRequest);
      positionValue = result.recommendedSize;
    } else {
      const positionSizePercent = config.maxPositionSize || 10;
      positionValue = currentEquity * (positionSizePercent / 100);
    }
    
    const entryPrice = Number(entryKline.close);
    const quantity = positionValue / entryPrice;

    const commission = entryPrice * quantity * (config.commission || 0.001);

    const { stopLoss, takeProfit } = this.calculateLevels(
      setup,
      entryPrice,
      config
    );

    const rewardAmount = takeProfit ? Math.abs(takeProfit - entryPrice) * quantity : 0;

    if (config.minProfitPercent) {
      const expectedProfitPercent = ((rewardAmount - commission * 2) / positionValue) * 100;
      if (expectedProfitPercent < config.minProfitPercent) {
        return null;
      }
    }

    const side = setup.direction === 'LONG' ? 'LONG' : 'SHORT';

    const trade: BacktestTrade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      setupId: setup.id,
      setupType: setup.type,
      setupConfidence: setup.confidence,
      entryTime: new Date(entryKline.openTime).toISOString(),
      entryPrice,
      side,
      quantity,
      stopLoss,
      takeProfit,
      commission,
      status: 'OPEN',
    };

    return trade;
  }

  private calculateLevels(
    setup: SetupDetectorResult['setup'],
    entryPrice: number,
    config: BacktestConfig
  ): { stopLoss: number; takeProfit: number | undefined } {
    if (!setup) {
      const stopLossPercent = config.stopLossPercent || 2;
      const takeProfitPercent = config.takeProfitPercent || 6;
      return {
        stopLoss: entryPrice * (1 - stopLossPercent / 100),
        takeProfit: entryPrice * (1 + takeProfitPercent / 100),
      };
    }

    if (config.useAlgorithmicLevels && setup.stopLoss) {
      return {
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
      };
    }

    const stopLossPercent = config.stopLossPercent || 2;
    const takeProfitPercent = config.takeProfitPercent || 6;

    if (setup.direction === 'LONG') {
      return {
        stopLoss: entryPrice * (1 - stopLossPercent / 100),
        takeProfit: entryPrice * (1 + takeProfitPercent / 100),
      };
    }

    return {
      stopLoss: entryPrice * (1 + stopLossPercent / 100),
      takeProfit: entryPrice * (1 - takeProfitPercent / 100),
    };
  }

  closePosition(
    trade: BacktestTrade,
    exitKline: Kline,
    exitReason: BacktestTrade['exitReason']
  ): BacktestTrade {
    const exitPrice = Number(exitKline.close);
    const commission = exitPrice * trade.quantity * 0.001;

    const pnl =
      trade.side === 'LONG'
        ? (exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - exitPrice) * trade.quantity;

    const totalCommission = trade.commission + commission;
    const netPnl = pnl - totalCommission;
    const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;

    return {
      ...trade,
      exitTime: new Date(exitKline.openTime).toISOString(),
      exitPrice,
      pnl,
      pnlPercent,
      commission: totalCommission,
      netPnl,
      exitReason,
      status: 'CLOSED',
    };
  }

  shouldTriggerStopLoss(trade: BacktestTrade, currentKline: Kline): boolean {
    if (!trade.stopLoss) return false;

    if (trade.side === 'LONG') {
      return Number(currentKline.low) <= trade.stopLoss;
    }

    return Number(currentKline.high) >= trade.stopLoss;
  }

  shouldTriggerTakeProfit(trade: BacktestTrade, currentKline: Kline): boolean {
    if (!trade.takeProfit) return false;

    if (trade.side === 'LONG') {
      return Number(currentKline.high) >= trade.takeProfit;
    }

    return Number(currentKline.low) <= trade.takeProfit;
  }

  calculateCurrentPnl(trade: BacktestTrade, currentPrice: number): number {
    const pnl =
      trade.side === 'LONG'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;

    return pnl - trade.commission;
  }

  calculateCurrentPnlPercent(trade: BacktestTrade, currentPrice: number): number {
    const pnl =
      trade.side === 'LONG'
        ? (currentPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - currentPrice) * trade.quantity;

    return (pnl / (trade.entryPrice * trade.quantity)) * 100;
  }
}
