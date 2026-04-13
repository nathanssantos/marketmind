import { AUTO_TRADING_LIQUIDATION } from '../../constants';
import type { TradeExecution } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { getBinanceFuturesDataService } from '../binance-futures-data';
import { logger } from '../logger';
import { getWebSocketService } from '../websocket';
import type { LiquidationRiskCheck, LiquidationRiskLevel } from './types';
import { LIQUIDATION_THRESHOLDS } from './types';

const lastLiquidationAlerts = new Map<string, { level: LiquidationRiskLevel; timestamp: number }>();
const LIQUIDATION_ALERT_COOLDOWN_MS = AUTO_TRADING_LIQUIDATION.ALERT_COOLDOWN_MS;
const MAX_LIQUIDATION_ALERTS = AUTO_TRADING_LIQUIDATION.MAX_ALERTS_IN_MEMORY;

const cleanupOldLiquidationAlerts = (): void => {
  const now = Date.now();
  for (const [key, value] of lastLiquidationAlerts) {
    if (now - value.timestamp > LIQUIDATION_ALERT_COOLDOWN_MS * 2) {
      lastLiquidationAlerts.delete(key);
    }
  }
  if (lastLiquidationAlerts.size > MAX_LIQUIDATION_ALERTS) {
    const entries = Array.from(lastLiquidationAlerts.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_LIQUIDATION_ALERTS);
    for (const [key] of toRemove) {
      lastLiquidationAlerts.delete(key);
    }
  }
};

const emitLiquidationAlert = async (walletId: string, risk: LiquidationRiskCheck): Promise<void> => {
  const alertKey = `${risk.executionId}-${risk.riskLevel}`;
  const lastAlert = lastLiquidationAlerts.get(alertKey);
  const now = Date.now();

  if (lastAlert && (now - lastAlert.timestamp) < LIQUIDATION_ALERT_COOLDOWN_MS) return;

  cleanupOldLiquidationAlerts();
  lastLiquidationAlerts.set(alertKey, { level: risk.riskLevel, timestamp: now });

  const wsService = getWebSocketService();
  if (!wsService) return;

  const distancePercentFormatted = (risk.distancePercent * 100).toFixed(2);
  const message = risk.riskLevel === 'critical'
    ? `! CRITICAL: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation!`
    : risk.riskLevel === 'danger'
      ? `! DANGER: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`
      : `! WARNING: ${risk.symbol} ${risk.side} position ${distancePercentFormatted}% from liquidation`;

  wsService.emitLiquidationWarning(walletId, {
    symbol: risk.symbol,
    side: risk.side,
    markPrice: risk.markPrice,
    liquidationPrice: risk.liquidationPrice,
    distancePercent: risk.distancePercent,
    riskLevel: risk.riskLevel as 'warning' | 'danger' | 'critical',
  });

  wsService.emitRiskAlert(walletId, {
    type: 'LIQUIDATION_RISK',
    level: risk.riskLevel as 'warning' | 'danger' | 'critical',
    positionId: risk.executionId,
    symbol: risk.symbol,
    message,
    data: {
      side: risk.side,
      markPrice: risk.markPrice,
      liquidationPrice: risk.liquidationPrice,
      distancePercent: risk.distancePercent,
    },
    timestamp: now,
  });

  logger.warn({
    executionId: risk.executionId,
    symbol: risk.symbol,
    side: risk.side,
    markPrice: risk.markPrice,
    liquidationPrice: risk.liquidationPrice,
    distancePercent: distancePercentFormatted,
    riskLevel: risk.riskLevel,
  }, `[LIQUIDATION RISK] ${risk.riskLevel.toUpperCase()} - Position approaching liquidation`);
};

export const checkLiquidationRisk = async (futuresExecutions: TradeExecution[]): Promise<LiquidationRiskCheck[]> => {
  const results: LiquidationRiskCheck[] = [];
  const executionsBySymbol = new Map<string, TradeExecution[]>();
  for (const e of futuresExecutions) {
    const arr = executionsBySymbol.get(e.symbol);
    if (arr) arr.push(e);
    else executionsBySymbol.set(e.symbol, [e]);
  }

  for (const [symbol, executionsForSymbol] of executionsBySymbol) {
    try {
      const markPriceData = await getBinanceFuturesDataService().getMarkPrice(symbol);
      if (!markPriceData) continue;

      const markPrice = markPriceData.markPrice;

      for (const execution of executionsForSymbol) {
        if (!execution.liquidationPrice) continue;

        const liquidationPrice = parseFloat(execution.liquidationPrice);
        if (liquidationPrice <= 0) continue;

        const distancePercent = execution.side === 'LONG'
          ? (markPrice - liquidationPrice) / markPrice
          : (liquidationPrice - markPrice) / markPrice;

        let riskLevel: LiquidationRiskLevel = 'safe';
        if (distancePercent <= LIQUIDATION_THRESHOLDS.CRITICAL) {
          riskLevel = 'critical';
        } else if (distancePercent <= LIQUIDATION_THRESHOLDS.DANGER) {
          riskLevel = 'danger';
        } else if (distancePercent <= LIQUIDATION_THRESHOLDS.WARNING) {
          riskLevel = 'warning';
        }

        const result: LiquidationRiskCheck = {
          executionId: execution.id,
          symbol,
          side: execution.side,
          markPrice,
          liquidationPrice,
          distancePercent,
          riskLevel,
        };

        results.push(result);

        if (riskLevel !== 'safe') {
          await emitLiquidationAlert(execution.walletId, result);
        }
      }
    } catch (error) {
      logger.error({
        symbol,
        error: serializeError(error),
      }, 'Error checking liquidation risk for symbol');
    }
  }

  return results;
};
