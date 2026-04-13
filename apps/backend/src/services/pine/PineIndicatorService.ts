import { PineTS } from 'pinets';
import type { Kline } from '@marketmind/types';

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

interface PlotEntry {
  value: number | null;
}

interface PlotResult {
  data: PlotEntry[];
}

type SingleIndicatorType =
  | 'sma' | 'ema' | 'rsi' | 'atr' | 'hma' | 'wma' | 'cci' | 'mfi'
  | 'roc' | 'cmo' | 'vwap' | 'obv' | 'wpr' | 'tsi' | 'sar' | 'highest' | 'lowest';

type MultiIndicatorType =
  | 'bb' | 'macd' | 'stoch' | 'kc' | 'supertrend' | 'dmi';

const SINGLE_SCRIPTS: Record<SingleIndicatorType, (p: Record<string, number>) => string> = {
  sma: (p) => `ta.sma(close, ${p['period'] ?? 20})`,
  ema: (p) => `ta.ema(close, ${p['period'] ?? 20})`,
  rsi: (p) => `ta.rsi(close, ${p['period'] ?? 14})`,
  atr: (p) => `ta.atr(${p['period'] ?? 14})`,
  hma: (p) => `ta.hma(close, ${p['period'] ?? 20})`,
  wma: (p) => `ta.wma(close, ${p['period'] ?? 20})`,
  cci: (p) => {
    const period = p['period'] ?? 14;
    return `nz((hlc3 - ta.sma(hlc3, ${period})) / (0.015 * ta.dev(hlc3, ${period})))`;
  },
  mfi: (p) => `ta.mfi(hlc3, ${p['period'] ?? 14})`,
  roc: (p) => `ta.roc(close, ${p['period'] ?? 12})`,
  cmo: (p) => `ta.cmo(close, ${p['period'] ?? 14})`,
  vwap: () => `ta.vwap(hlc3)`,
  obv: () => `ta.obv()`,
  wpr: (p) => `ta.wpr(${p['period'] ?? 14})`,
  tsi: (p) => `ta.tsi(close, ${p['shortPeriod'] ?? 13}, ${p['longPeriod'] ?? 25})`,
  sar: (p) => `ta.sar(${p['start'] ?? 0.02}, ${p['increment'] ?? 0.02}, ${p['max'] ?? 0.2})`,
  highest: (p) => `ta.highest(high, ${p['period'] ?? 20})`,
  lowest: (p) => `ta.lowest(low, ${p['period'] ?? 20})`,
};

const MULTI_SCRIPTS: Record<MultiIndicatorType, (p: Record<string, number>) => { decl: string; plots: string[] }> = {
  bb: (p) => ({
    decl: `[_bb_m, _bb_u, _bb_l] = ta.bb(close, ${p['period'] ?? 20}, ${p['stdDev'] ?? 2})`,
    plots: ['middle:_bb_m', 'upper:_bb_u', 'lower:_bb_l'],
  }),
  macd: (p) => ({
    decl: `[_mc_l, _mc_s, _mc_h] = ta.macd(close, ${p['fastPeriod'] ?? 12}, ${p['slowPeriod'] ?? 26}, ${p['signalPeriod'] ?? 9})`,
    plots: ['line:_mc_l', 'signal:_mc_s', 'histogram:_mc_h'],
  }),
  stoch: (p) => ({
    decl: `_st_k = ta.stoch(close, high, low, ${p['period'] ?? 14}, ${p['smoothK'] ?? 3}, 3)\n_st_d = ta.sma(_st_k, 3)`,
    plots: ['k:_st_k', 'd:_st_d'],
  }),
  kc: (p) => ({
    decl: `[_kc_m, _kc_u, _kc_l] = ta.kc(close, ${p['period'] ?? 20}, ${p['multiplier'] ?? 2})`,
    plots: ['middle:_kc_m', 'upper:_kc_u', 'lower:_kc_l'],
  }),
  supertrend: (p) => ({
    decl: `[_sup_v, _sup_d] = ta.supertrend(${p['multiplier'] ?? 3}, ${p['period'] ?? 10})`,
    plots: ['value:_sup_v', 'direction:_sup_d'],
  }),
  dmi: (p) => ({
    decl: `[_dm_p, _dm_m, _dm_a] = ta.dmi(${p['period'] ?? 14}, ${p['period'] ?? 14})`,
    plots: ['plusDI:_dm_p', 'minusDI:_dm_m', 'adx:_dm_a'],
  }),
};

const mapKline = (k: Kline): PineTSKline => ({
  openTime: k.openTime,
  open: parseFloat(k.open),
  high: parseFloat(k.high),
  low: parseFloat(k.low),
  close: parseFloat(k.close),
  volume: parseFloat(k.volume),
  closeTime: k.closeTime,
  quoteAssetVolume: parseFloat(k.quoteVolume),
  numberOfTrades: k.trades,
  takerBuyBaseAssetVolume: parseFloat(k.takerBuyBaseVolume),
  takerBuyQuoteAssetVolume: parseFloat(k.takerBuyQuoteVolume),
  ignore: 0,
});

const extractPlotValues = (plots: Record<string, PlotResult>, name: string): (number | null)[] => {
  const plot = plots[name];
  if (!plot?.data) return [];
  return plot.data.map((e) => {
    if (e.value === null || e.value === undefined) return null;
    if (typeof e.value === 'number' && isNaN(e.value)) return null;
    return e.value;
  });
};

export class PineIndicatorService {
  async compute(
    type: SingleIndicatorType,
    klines: Kline[],
    params: Record<string, number> = {}
  ): Promise<(number | null)[]> {
    if (klines.length === 0) return [];

    const scriptFn = SINGLE_SCRIPTS[type];
    if (!scriptFn) throw new Error(`Unsupported single indicator type: ${type}`);

    const expr = scriptFn(params);
    const source = `//@version=5\nindicator("ind")\nplot(${expr}, "r")`;

    const pineTSKlines = klines.map(mapKline);
    const pine = new PineTS(pineTSKlines, 'IND', '1h');
    await pine.ready();

    const ctx = await pine.run(source);
    return extractPlotValues(ctx.plots as Record<string, PlotResult>, 'r');
  }

  async computeMulti(
    type: MultiIndicatorType,
    klines: Kline[],
    params: Record<string, number> = {}
  ): Promise<Record<string, (number | null)[]>> {
    if (klines.length === 0) return {};

    const scriptFn = MULTI_SCRIPTS[type];
    if (!scriptFn) throw new Error(`Unsupported multi indicator type: ${type}`);

    const { decl, plots: plotDefs } = scriptFn(params);
    const plotLines = plotDefs.map((def) => {
      const [name, varName] = def.split(':');
      return `plot(${varName}, "${name}")`;
    });

    const source = `//@version=5\nindicator("ind")\n${decl}\n${plotLines.join('\n')}`;

    const pineTSKlines = klines.map(mapKline);
    const pine = new PineTS(pineTSKlines, 'IND', '1h');
    await pine.ready();

    const ctx = await pine.run(source);
    const result: Record<string, (number | null)[]> = {};

    for (const def of plotDefs) {
      const [name] = def.split(':');
      result[name!] = extractPlotValues(ctx.plots as Record<string, PlotResult>, name!);
    }

    return result;
  }

  async computeEMA(klines: Kline[], period: number): Promise<(number | null)[]> {
    return this.compute('ema', klines, { period });
  }

  async computeSMA(klines: Kline[], period: number): Promise<(number | null)[]> {
    return this.compute('sma', klines, { period });
  }

  async computeRSI(klines: Kline[], period: number): Promise<(number | null)[]> {
    return this.compute('rsi', klines, { period });
  }

  async computeATR(klines: Kline[], period: number): Promise<(number | null)[]> {
    return this.compute('atr', klines, { period });
  }

  async computeMACD(
    klines: Kline[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ): Promise<Record<string, (number | null)[]>> {
    return this.computeMulti('macd', klines, { fastPeriod, slowPeriod, signalPeriod });
  }

  async computeBB(
    klines: Kline[],
    period = 20,
    stdDev = 2
  ): Promise<Record<string, (number | null)[]>> {
    return this.computeMulti('bb', klines, { period, stdDev });
  }

  async computeStochastic(
    klines: Kline[],
    period = 14,
    smoothK = 3
  ): Promise<Record<string, (number | null)[]>> {
    return this.computeMulti('stoch', klines, { period, smoothK });
  }

  async computeDMI(
    klines: Kline[],
    period = 14
  ): Promise<Record<string, (number | null)[]>> {
    return this.computeMulti('dmi', klines, { period });
  }

  async computeSupertrend(
    klines: Kline[],
    multiplier = 3,
    period = 10
  ): Promise<Record<string, (number | null)[]>> {
    return this.computeMulti('supertrend', klines, { multiplier, period });
  }
}
