import type { Kline } from '@marketmind/types';
import type { KlineUpdate } from '../binance-kline-stream';
import { getBinanceFuturesDataService } from '../binance-futures-data';
import { logger } from '../logger';
import { PineIndicatorService } from '../pine/PineIndicatorService';
import type { IndicatorState } from './types';

const BUFFER_SIZE = 60;
const EMA_SHORT_PERIOD = 7;
const EMA_LONG_PERIOD = 9;
const CCI_PERIOD = 14;
const ATR_PERIOD = 14;
const SAR_AF_START = 0.03;
const SAR_AF_MAX = 0.3;
const SAR_AF_INCREMENT = 0.03;

const toKline = (k: {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}): Kline => ({
  openTime: k.openTime,
  open: String(k.open),
  high: String(k.high),
  low: String(k.low),
  close: String(k.close),
  volume: String(k.volume),
  closeTime: k.closeTime,
  quoteVolume: String(k.quoteVolume),
  trades: k.trades,
  takerBuyBaseVolume: String(k.takerBuyBaseVolume),
  takerBuyQuoteVolume: String(k.takerBuyQuoteVolume),
});

const klineFromUpdate = (update: KlineUpdate): Kline => ({
  openTime: update.openTime,
  open: update.open,
  high: update.high,
  low: update.low,
  close: update.close,
  volume: update.volume,
  closeTime: update.closeTime,
  quoteVolume: update.quoteVolume,
  trades: update.trades,
  takerBuyBaseVolume: update.takerBuyBaseVolume,
  takerBuyQuoteVolume: update.takerBuyQuoteVolume,
});

export class KlineIndicatorManager {
  private klineBuffers = new Map<string, Kline[]>();
  private indicatorCache = new Map<string, IndicatorState>();

  async initialize(symbol: string, interval: string): Promise<void> {
    try {
      const service = getBinanceFuturesDataService();
      const rawKlines = await service.getFuturesKlines(symbol, interval, undefined, undefined, BUFFER_SIZE);
      const klines = rawKlines.map(toKline);
      this.klineBuffers.set(symbol, klines);
      await this.computeIndicators(symbol);
      logger.info({ symbol, interval, bars: klines.length }, 'KlineIndicatorManager initialized');
    } catch (error) {
      logger.error({ error, symbol, interval }, 'Failed to initialize kline indicator buffer');
      this.klineBuffers.set(symbol, []);
    }
  }

  async processKlineClose(update: KlineUpdate): Promise<void> {
    const buffer = this.klineBuffers.get(update.symbol);
    if (!buffer) return;

    buffer.push(klineFromUpdate(update));
    if (buffer.length > BUFFER_SIZE) buffer.shift();

    await this.computeIndicators(update.symbol);
  }

  getIndicators(symbol: string): IndicatorState | null {
    return this.indicatorCache.get(symbol) ?? null;
  }

  clear(): void {
    this.klineBuffers.clear();
    this.indicatorCache.clear();
  }

  private async computeIndicators(symbol: string): Promise<void> {
    const klines = this.klineBuffers.get(symbol);
    if (!klines || klines.length < EMA_LONG_PERIOD) return;

    const pineService = new PineIndicatorService();

    const [ema7Raw, ema9Raw, cciRaw, sarRaw, atrRaw] = await Promise.all([
      pineService.compute('ema', klines, { period: EMA_SHORT_PERIOD }),
      pineService.compute('ema', klines, { period: EMA_LONG_PERIOD }),
      pineService.compute('cci', klines, { period: CCI_PERIOD }),
      pineService.compute('sar', klines, { start: SAR_AF_START, increment: SAR_AF_INCREMENT, max: SAR_AF_MAX }),
      pineService.compute('atr', klines, { period: ATR_PERIOD }),
    ]);

    const ema7 = ema7Raw.filter((v): v is number => v !== null);
    const ema9 = ema9Raw.filter((v): v is number => v !== null);
    const cci = cciRaw.filter((v): v is number => v !== null);

    const lastClose = parseFloat(klines[klines.length - 1]?.close ?? '0');
    const lastSar = sarRaw[sarRaw.length - 1];
    const sarTrend: 'UP' | 'DOWN' | null = lastSar !== null && lastSar !== undefined
      ? (lastSar < lastClose ? 'UP' : 'DOWN')
      : null;

    const lastAtr = atrRaw.length > 0 ? atrRaw[atrRaw.length - 1] : null;
    const atr = lastAtr !== null && lastAtr !== undefined && !isNaN(lastAtr) ? lastAtr : null;

    this.indicatorCache.set(symbol, { ema7, ema9, cci, sarTrend, atr });
  }
}
