import type { Kline } from '@marketmind/types';

/**
 * PineTS-compatible market data provider that resolves `request.security(...)`
 * calls against pre-loaded klines (typically fetched from our own DB +
 * smart-backfill, NOT from an external Provider like Binance live).
 *
 * Why this exists:
 *   PineTS supports two ways to source kline data:
 *     1. Array form  — `new PineTS(klines, ticker, tf)`. No secondary TF
 *        support: `request.security(...)` calls silently return NaN
 *        because PineTS has no way to fetch additional data.
 *     2. Provider form — `new PineTS(provider, ticker, tf)` where
 *        `provider.getMarketData(symbol, tf, ...)` returns klines for
 *        any requested (symbol, tf). PineTS internally calls this
 *        when a script references `request.security('SYMBOL', 'TF', ...)`.
 *
 *   For multi-TF backtests + live runtime to work, we MUST be on path #2.
 *   This class is a duck-typed Provider implementation: it has the
 *   minimum surface PineTS calls (`getMarketData`, `getSupportedTimeframes`,
 *   `getSymbolInfo`) and serves pre-loaded klines per timeframe.
 *
 * Look-ahead safety:
 *   PineTS handles the look-ahead semantics internally via the `lookahead`
 *   argument to `request.security(..., lookahead=barmerge.lookahead_off)`.
 *   This provider does NOT add any extra safety; if the strategy author
 *   omits `lookahead_off`, the script will see the HTF candle's future
 *   close on the LTF bar that's still inside it. That's a strategy bug,
 *   not a runtime bug — see the look-ahead test in PineStrategyRunner
 *   test suite for the deterministic invariant we DO enforce in the
 *   built-in adapter.
 */

const PINE_TF_TO_LABEL: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '45': '45m',
  '60': '1h',
  '120': '2h',
  '180': '3h',
  '240': '4h',
  'D': '1d',
  'W': '1w',
  'M': '1M',
  // PineTS may pass either the normalized form ('60') or the raw form
  // ('1h') depending on call site. Accept both as aliases.
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '45m': '45m',
  '1h': '1h',
  '2h': '2h',
  '3h': '3h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

// PineTS expects a richer Kline shape than ours — these extra fields
// (quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, etc.) are
// Binance-specific and not consumed by any indicator-level operation
// PineTS performs internally. We zero-fill them to satisfy the IProvider
// interface; if a strategy ever reads them, they'll see 0, which is
// strictly safer than NaN.
interface PineMarketKline {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openTime: number;
  closeTime: number;
  quoteAssetVolume: number;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: number;
  takerBuyQuoteAssetVolume: number;
  ignore: number;
}

const mapKline = (k: Kline): PineMarketKline => ({
  open: typeof k.open === 'number' ? k.open : parseFloat(String(k.open)),
  high: typeof k.high === 'number' ? k.high : parseFloat(String(k.high)),
  low: typeof k.low === 'number' ? k.low : parseFloat(String(k.low)),
  close: typeof k.close === 'number' ? k.close : parseFloat(String(k.close)),
  volume: typeof k.volume === 'number' ? k.volume : parseFloat(String(k.volume)),
  openTime: typeof k.openTime === 'number' ? k.openTime : new Date(k.openTime).getTime(),
  closeTime: typeof k.closeTime === 'number' ? k.closeTime : new Date(k.closeTime).getTime(),
  quoteAssetVolume: 0,
  numberOfTrades: 0,
  takerBuyBaseAssetVolume: 0,
  takerBuyQuoteAssetVolume: 0,
  ignore: 0,
});

export class PineMarketProvider {
  private klinesByLabel: Map<string, PineMarketKline[]> = new Map();
  // Required by PineTS internals — it reads these fields off the provider
  // for cache keying and config detection. Mirror BaseProvider defaults.
  readonly _configured = true;
  readonly _requiresApiKey = false;
  readonly _providerName = 'MARKETMIND';
  readonly _aggregationSubTimeframe: string | null = null;

  constructor(klinesByLabel: Record<string, Kline[]>) {
    for (const [label, klines] of Object.entries(klinesByLabel)) {
      const normalized = PINE_TF_TO_LABEL[label] ?? label;
      this.klinesByLabel.set(normalized, klines.map(mapKline));
    }
  }

  /**
   * PineTS reads this to decide whether a requested timeframe needs to
   * be aggregated from a sub-timeframe (slow path) or can be served
   * directly (fast path). We return the Pine-normalized form of every
   * label we have klines for so PineTS picks the fast path.
   */
  getSupportedTimeframes(): Set<string> {
    const out = new Set<string>();
    // Reverse the normalization map so we expose both forms (e.g. '4h'
    // and '240') — PineTS internally checks the normalized side.
    for (const label of this.klinesByLabel.keys()) {
      out.add(label);
      for (const [pineForm, ourLabel] of Object.entries(PINE_TF_TO_LABEL)) {
        if (ourLabel === label) out.add(pineForm);
      }
    }
    return out;
  }

  async getMarketData(
    _symbol: string,
    timeframe: string,
    _limit?: number,
    _sDate?: number,
    _eDate?: number,
  ): Promise<PineMarketKline[]> {
    const label = PINE_TF_TO_LABEL[timeframe] ?? timeframe;
    const klines = this.klinesByLabel.get(label);
    if (!klines) {
      throw new Error(
        `PineMarketProvider: no klines registered for timeframe='${timeframe}' (label='${label}'). `
        + `Available: [${Array.from(this.klinesByLabel.keys()).join(', ')}]. `
        + `Did the strategy declare '@requires-tf ${label}' and did the engine load the matching klines?`,
      );
    }
    return klines;
  }

  // PineTS's ISymbolInfo has 40+ fields, most of which are stock-specific
  // (shares_outstanding, recommendations_*, target_price_*). For crypto
  // we only ever read ticker/tickerid/mintick/timezone — zero/empty
  // everything else.
  async getSymbolInfo(symbol: string): Promise<{
    current_contract: string;
    description: string;
    isin: string;
    main_tickerid: string;
    prefix: string;
    root: string;
    ticker: string;
    tickerid: string;
    type: string;
    basecurrency: string;
    country: string;
    currency: string;
    timezone: string;
    employees: number;
    industry: string;
    sector: string;
    shareholders: number;
    shares_outstanding_float: number;
    shares_outstanding_total: number;
    expiration_date: number;
    session: string;
    volumetype: string;
    mincontract: number;
    minmove: number;
    mintick: number;
    pointvalue: number;
    pricescale: number;
    recommendations_buy: number;
    recommendations_buy_strong: number;
    recommendations_date: number;
    recommendations_hold: number;
    recommendations_sell: number;
    recommendations_sell_strong: number;
    recommendations_total: number;
    target_price_average: number;
    target_price_date: number;
    target_price_estimates: number;
    target_price_high: number;
    target_price_low: number;
    target_price_median: number;
  }> {
    return {
      current_contract: '', description: symbol, isin: '', main_tickerid: symbol,
      prefix: '', root: '', ticker: symbol, tickerid: symbol,
      type: 'crypto', basecurrency: 'USDT', country: '', currency: 'USDT',
      timezone: 'Etc/UTC', employees: 0, industry: '', sector: '',
      shareholders: 0, shares_outstanding_float: 0, shares_outstanding_total: 0,
      expiration_date: 0, session: '24x7', volumetype: 'base',
      mincontract: 0, minmove: 1, mintick: 0.01, pointvalue: 1, pricescale: 100,
      recommendations_buy: 0, recommendations_buy_strong: 0,
      recommendations_date: 0, recommendations_hold: 0,
      recommendations_sell: 0, recommendations_sell_strong: 0,
      recommendations_total: 0,
      target_price_average: 0, target_price_date: 0, target_price_estimates: 0,
      target_price_high: 0, target_price_low: 0, target_price_median: 0,
    };
  }

  // Stub — PineTS calls this on the BaseProvider class; harmless default.
  normalizeCloseTime(closeTime: number): number {
    return closeTime;
  }

  setAggregationSubTimeframe(_tf: string | null): void {
    // no-op
  }

  ensureConfigured(): void {
    // no-op — we are always configured (data preloaded)
  }

  isConfigured(): boolean {
    return true;
  }

  // Required by PineTS's IProvider interface. We never re-configure
  // because data is pre-loaded at construction; this is a no-op stub
  // so the structural type check passes.
  configure(_config: unknown): void {
    // no-op
  }
}
