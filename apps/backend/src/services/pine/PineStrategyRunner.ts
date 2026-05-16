import { Indicator, PineTS } from 'pinets';
import { PineMarketProvider } from './PineMarketProvider';
import type { Kline, TradingSetup, SetupDirection } from '@marketmind/types';
import { EXIT_CALCULATOR } from '../../constants';
import type {
  PineDetectionResult,
  PinePlotEntry,
  PineRunOptions,
  PineStrategy,
} from './types';

const SIGNAL_PLOT = 'signal';
const STOP_LOSS_PLOT = 'stopLoss';
const TAKE_PROFIT_PLOT = 'takeProfit';
const CONFIDENCE_PLOT = 'confidence';
const EXIT_SIGNAL_PLOT = 'exitSignal';

const LONG_SIGNAL = 1;
const SHORT_SIGNAL = -1;

const DEFAULT_MIN_CONFIDENCE = 50;
const DEFAULT_MIN_RISK_REWARD = 1.0;
const MIN_STOP_DISTANCE_PERCENT = EXIT_CALCULATOR.MIN_STOP_DISTANCE_PERCENT / 100;

interface PineTSKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
  ignore: number;
}

const mapKlineToPineTS = (kline: Kline): PineTSKline => ({
  openTime: kline.openTime,
  open: parseFloat(kline.open),
  high: parseFloat(kline.high),
  low: parseFloat(kline.low),
  close: parseFloat(kline.close),
  volume: parseFloat(kline.volume),
  closeTime: kline.closeTime,
  quoteAssetVolume: parseFloat(kline.quoteVolume),
  numberOfTrades: kline.trades,
  takerBuyBaseAssetVolume: parseFloat(kline.takerBuyBaseVolume),
  takerBuyQuoteAssetVolume: parseFloat(kline.takerBuyQuoteVolume),
  ignore: 0,
});

const enforceMinimumStopDistance = (
  entryPrice: number,
  stopLoss: number | null,
  direction: SetupDirection
): number | null => {
  if (stopLoss === null) return null;

  const minDistance = entryPrice * MIN_STOP_DISTANCE_PERCENT;
  const currentDistance = Math.abs(entryPrice - stopLoss);

  if (currentDistance >= minDistance) return stopLoss;

  return direction === 'LONG'
    ? entryPrice - minDistance
    : entryPrice + minDistance;
};

const calculateRR = (
  entry: number,
  stopLoss: number | null,
  takeProfit: number | null
): number => {
  if (stopLoss === null || takeProfit === null) return 0;

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);

  return risk === 0 ? 0 : reward / risk;
};

interface PinePlotResult {
  data: PinePlotEntry[];
}

const getPlotData = (
  plots: Record<string, PinePlotResult | PinePlotEntry[]>,
  plotName: string
): PinePlotEntry[] | undefined => {
  const plot = plots[plotName];
  if (!plot) return undefined;
  if (Array.isArray(plot)) return plot;
  if (plot.data && Array.isArray(plot.data)) return plot.data;
  return undefined;
};

const extractPlotValue = (
  plots: Record<string, PinePlotResult | PinePlotEntry[]>,
  plotName: string,
  index: number
): number | null => {
  const data = getPlotData(plots, plotName);
  if (!data || index >= data.length) return null;

  const entry = data[index];
  if (entry?.value == null) return null;
  if (typeof entry.value === 'number' && isNaN(entry.value)) return null;

  return entry.value;
};

export class PineStrategyRunner {
  async detectSignals(
    strategy: PineStrategy,
    klines: Kline[],
    options?: PineRunOptions
  ): Promise<PineDetectionResult[]> {
    if (klines.length === 0) return [];

    const primaryTimeframe = options?.primaryTimeframe ?? '1h';
    const hasSecondary = options?.secondaryKlines
      && Object.keys(options.secondaryKlines).length > 0;

    let pine: PineTS;
    if (hasSecondary) {
      // Multi-TF mode: route through a Provider so PineTS can resolve
      // `request.security(...)` against our pre-loaded HTF klines.
      // Includes the primary klines under its own label so PineTS's
      // sub-context initialization works for both directions of TF
      // comparison (LTF ↔ HTF).
      const provider = new PineMarketProvider({
        [primaryTimeframe]: klines,
        ...options.secondaryKlines,
      });
      pine = new PineTS(provider, 'MARKETMIND', primaryTimeframe);
    } else {
      // Single-TF backward-compat path: array form is faster
      // (no Provider setup roundtrip) and identical for strategies
      // that never call `request.security`.
      const pineTSKlines = klines.map(mapKlineToPineTS);
      pine = new PineTS(pineTSKlines, 'MARKETMIND', primaryTimeframe);
    }
    await pine.ready();

    // Strategy parameter overrides: when `parameterOverrides` is set, wrap
    // the source in an `Indicator(source, inputs)` so PineTS substitutes
    // the matching `input.int/float/bool/string` defaults at runtime. Used
    // both for backtest config-driven sweeps (optimization) and for
    // backtest pipeline smoke tests where the strategy's built-in
    // thresholds are too tight for a meaningful sample size.
    const overrides = options?.parameterOverrides;
    const runnable = overrides && Object.keys(overrides).length > 0
      ? new Indicator(strategy.source, overrides)
      : strategy.source;
    const ctx = await pine.run(runnable);
    const plots = ctx.plots as Record<string, PinePlotResult | PinePlotEntry[]>;

    const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const minRiskReward = options?.minRiskReward ?? DEFAULT_MIN_RISK_REWARD;

    const results: PineDetectionResult[] = [];

    const signalData = getPlotData(plots, SIGNAL_PLOT);
    if (!signalData) return [];

    for (let i = 0; i < signalData.length; i++) {
      const signalValue = extractPlotValue(plots, SIGNAL_PLOT, i);
      if (signalValue === null || signalValue === 0) continue;

      const direction: SetupDirection =
        signalValue === LONG_SIGNAL ? 'LONG' : signalValue === SHORT_SIGNAL ? 'SHORT' : 'LONG';

      if (signalValue !== LONG_SIGNAL && signalValue !== SHORT_SIGNAL) continue;

      const kline = klines[i];
      if (!kline) continue;

      const entryPrice = parseFloat(kline.close);
      const rawStopLoss = extractPlotValue(plots, STOP_LOSS_PLOT, i);
      const takeProfit = extractPlotValue(plots, TAKE_PROFIT_PLOT, i);
      const confidence = extractPlotValue(plots, CONFIDENCE_PLOT, i) ?? 70;

      if (confidence < minConfidence) {
        results.push({ setup: null, confidence, triggerKlineIndex: i });
        continue;
      }

      const stopLoss = enforceMinimumStopDistance(entryPrice, rawStopLoss, direction);
      const riskRewardRatio = calculateRR(entryPrice, stopLoss, takeProfit);

      if (riskRewardRatio > 0 && riskRewardRatio < minRiskReward) {
        results.push({ setup: null, confidence, triggerKlineIndex: i });
        continue;
      }

      const setup: TradingSetup = {
        id: `${strategy.metadata.id}-${i}-${Date.now()}`,
        type: strategy.metadata.id,
        direction,
        openTime: kline.openTime,
        entryPrice,
        stopLoss: stopLoss ?? undefined,
        takeProfit: takeProfit ?? undefined,
        riskRewardRatio,
        confidence,
        volumeConfirmation: false,
        indicatorConfluence: 0,
        klineIndex: i,
        setupData: {
          source: 'pine',
          strategyName: strategy.metadata.name,
        },
        visible: true,
        source: 'algorithm',
      };

      results.push({ setup, confidence, triggerKlineIndex: i });
    }

    const exitSignalData = getPlotData(plots, EXIT_SIGNAL_PLOT);
    if (exitSignalData) {
      const exitSignals = exitSignalData.map((e) => e?.value ?? null);
      for (const result of results) {
        if (result.setup) result.exitSignals = exitSignals;
      }
    }

    return results;
  }

  async detectAtIndex(
    strategy: PineStrategy,
    klines: Kline[],
    targetIndex: number,
    options?: PineRunOptions
  ): Promise<PineDetectionResult> {
    const results = await this.detectSignals(
      strategy,
      klines.slice(0, targetIndex + 1),
      options
    );

    const match = results.find((r) => r.triggerKlineIndex === targetIndex);
    return match ?? { setup: null, confidence: 0 };
  }
}
