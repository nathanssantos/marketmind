import type { Interval } from '@marketmind/types';
import type { klines } from '../db/schema';

const MIN_VOLUME_FOR_VALIDITY = 0.01;
const MIN_RANGE_RATIO = 0.05;
const MIN_VOLUME_THRESHOLD = 0.0001;
const SPIKE_THRESHOLD_PERCENT = 0.15;
const VOLUME_ANOMALY_RATIO = 0.01;
const RANGE_ANOMALY_RATIO = 0.05;
const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  shouldFetchFromAPI?: boolean;
}

export interface CorruptedKline {
  openTime: Date;
  reason: string;
}

export interface OHLCMismatch {
  field: 'open' | 'high' | 'low' | 'close';
  dbValue: number;
  apiValue: number;
  diffPercent: number;
}

export interface ValidationAgainstAPIResult {
  isValid: boolean;
  mismatches: OHLCMismatch[];
}

type DbKline = typeof klines.$inferSelect;

interface BinanceKlineResponse {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export class KlineValidator {
  static isKlineDataSuspicious(
    newData: { volume: string; high: string; low: string },
    existingData?: { volume: string; high: string; low: string }
  ): ValidationResult {
    const newVolume = parseFloat(newData.volume);
    const newRange = parseFloat(newData.high) - parseFloat(newData.low);

    if (newVolume < MIN_VOLUME_FOR_VALIDITY) {
      return {
        isValid: false,
        reason: `Low volume: ${newVolume} < ${MIN_VOLUME_FOR_VALIDITY}`,
        shouldFetchFromAPI: true,
      };
    }

    if (existingData) {
      const existingVolume = parseFloat(existingData.volume);
      const existingRange = parseFloat(existingData.high) - parseFloat(existingData.low);

      if (existingVolume > 0 && newVolume / existingVolume < MIN_RANGE_RATIO) {
        return {
          isValid: false,
          reason: `Volume ratio too low: ${(newVolume / existingVolume * 100).toFixed(2)}% < ${MIN_RANGE_RATIO * 100}%`,
          shouldFetchFromAPI: true,
        };
      }

      if (existingRange > 0 && newRange / existingRange < MIN_RANGE_RATIO) {
        return {
          isValid: false,
          reason: `Range ratio too low: ${(newRange / existingRange * 100).toFixed(2)}% < ${MIN_RANGE_RATIO * 100}%`,
          shouldFetchFromAPI: true,
        };
      }
    }

    return { isValid: true };
  }

  static isKlineCorrupted(kline: DbKline): CorruptedKline | null {
    const open = parseFloat(kline.open);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const close = parseFloat(kline.close);
    const volume = parseFloat(kline.volume);

    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
      return { openTime: kline.openTime, reason: 'NaN values' };
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      return { openTime: kline.openTime, reason: 'Zero or negative prices' };
    }

    if (volume < MIN_VOLUME_THRESHOLD) {
      return { openTime: kline.openTime, reason: `Zero or negligible volume: ${volume}` };
    }

    if (low > high) {
      return { openTime: kline.openTime, reason: 'Low > High' };
    }

    if (open > high || open < low) {
      return { openTime: kline.openTime, reason: 'Open outside High/Low range' };
    }

    if (close > high || close < low) {
      return { openTime: kline.openTime, reason: 'Close outside High/Low range' };
    }

    if (open === high && high === low && low === close) {
      return { openTime: kline.openTime, reason: 'Flat candle (O=H=L=C) - likely corrupted' };
    }

    return null;
  }

  static isKlineStaleCorrupted(
    kline: DbKline,
    prevKline: DbKline | null,
    nextKline: DbKline | null
  ): CorruptedKline | null {
    const open = parseFloat(kline.open);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const close = parseFloat(kline.close);

    const highEqualsOpen = Math.abs(high - open) < 0.00001;
    const lowEqualsOpen = Math.abs(low - open) < 0.00001;

    if (highEqualsOpen && !lowEqualsOpen) {
      const hasNeighborWithHigherHigh =
        (prevKline && parseFloat(prevKline.high) > high) ||
        (nextKline && parseFloat(nextKline.high) > high);

      if (hasNeighborWithHigherHigh) {
        return { openTime: kline.openTime, reason: 'Stale candle: High equals Open (likely incomplete data)' };
      }
    }

    if (lowEqualsOpen && !highEqualsOpen) {
      const hasNeighborWithLowerLow =
        (prevKline && parseFloat(prevKline.low) < low) ||
        (nextKline && parseFloat(nextKline.low) < low);

      if (hasNeighborWithLowerLow) {
        return { openTime: kline.openTime, reason: 'Stale candle: Low equals Open (likely incomplete data)' };
      }
    }

    if (highEqualsOpen && lowEqualsOpen && high === low && high === close) {
      return { openTime: kline.openTime, reason: 'Stale candle: All OHLC values equal (incomplete data)' };
    }

    return null;
  }

  static isKlineSpikeCorrupted(
    kline: DbKline,
    prevKline: DbKline | null,
    nextKline: DbKline | null
  ): CorruptedKline | null {
    if (!prevKline && !nextKline) return null;

    const close = parseFloat(kline.close);
    const high = parseFloat(kline.high);
    const low = parseFloat(kline.low);
    const volume = parseFloat(kline.volume);
    const range = high - low;

    const neighborPrices: number[] = [];
    const neighborVolumes: number[] = [];
    const neighborRanges: number[] = [];

    if (prevKline) {
      neighborPrices.push(parseFloat(prevKline.close), parseFloat(prevKline.high), parseFloat(prevKline.low));
      neighborVolumes.push(parseFloat(prevKline.volume));
      neighborRanges.push(parseFloat(prevKline.high) - parseFloat(prevKline.low));
    }
    if (nextKline) {
      neighborPrices.push(parseFloat(nextKline.close), parseFloat(nextKline.high), parseFloat(nextKline.low));
      neighborVolumes.push(parseFloat(nextKline.volume));
      neighborRanges.push(parseFloat(nextKline.high) - parseFloat(nextKline.low));
    }

    const avgNeighborVolume = neighborVolumes.reduce((a, b) => a + b, 0) / neighborVolumes.length;
    if (avgNeighborVolume > 0 && volume / avgNeighborVolume < VOLUME_ANOMALY_RATIO) {
      return {
        openTime: kline.openTime,
        reason: `Anomalous low volume: ${volume.toFixed(2)} vs avg ${avgNeighborVolume.toFixed(2)} (${((volume / avgNeighborVolume) * 100).toFixed(2)}%)`,
      };
    }

    const avgNeighborRange = neighborRanges.reduce((a, b) => a + b, 0) / neighborRanges.length;
    if (avgNeighborRange > 0 && range / avgNeighborRange < RANGE_ANOMALY_RATIO) {
      return {
        openTime: kline.openTime,
        reason: `Anomalous small range: ${range.toFixed(2)} vs avg ${avgNeighborRange.toFixed(2)} (${((range / avgNeighborRange) * 100).toFixed(2)}%)`,
      };
    }

    const avgNeighborPrice = neighborPrices.reduce((a, b) => a + b, 0) / neighborPrices.length;
    const maxNeighborHigh = Math.max(...neighborPrices);
    const minNeighborLow = Math.min(...neighborPrices);

    const closeDeviation = Math.abs(close - avgNeighborPrice) / avgNeighborPrice;
    if (closeDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `Close price spike: ${(closeDeviation * 100).toFixed(1)}% deviation` };
    }

    const highDeviation = (high - maxNeighborHigh) / maxNeighborHigh;
    if (highDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `High price spike: ${(highDeviation * 100).toFixed(1)}% above neighbors` };
    }

    const lowDeviation = (minNeighborLow - low) / minNeighborLow;
    if (lowDeviation > SPIKE_THRESHOLD_PERCENT) {
      return { openTime: kline.openTime, reason: `Low price spike: ${(lowDeviation * 100).toFixed(1)}% below neighbors` };
    }

    return null;
  }

  static async validateAgainstAPI(
    kline: DbKline,
    symbol: string,
    interval: Interval,
    marketType: 'SPOT' | 'FUTURES'
  ): Promise<ValidationAgainstAPIResult> {
    const apiKline = await this.fetchBinanceKline(
      symbol,
      interval,
      kline.openTime.getTime(),
      marketType
    );

    if (!apiKline) return { isValid: true, mismatches: [] };

    const tolerance = 0.001;
    const fields: Array<{ name: 'open' | 'high' | 'low' | 'close'; db: number; api: number }> = [
      { name: 'open', db: parseFloat(kline.open), api: parseFloat(apiKline.open) },
      { name: 'high', db: parseFloat(kline.high), api: parseFloat(apiKline.high) },
      { name: 'low', db: parseFloat(kline.low), api: parseFloat(apiKline.low) },
      { name: 'close', db: parseFloat(kline.close), api: parseFloat(apiKline.close) },
    ];

    const mismatches: OHLCMismatch[] = [];

    for (const field of fields) {
      const diff = Math.abs(field.db - field.api);
      const relativeDiff = diff / field.api;

      if (relativeDiff > tolerance) {
        mismatches.push({
          field: field.name,
          dbValue: field.db,
          apiValue: field.api,
          diffPercent: relativeDiff * 100,
        });
      }
    }

    return { isValid: mismatches.length === 0, mismatches };
  }

  private static async fetchBinanceKline(
    symbol: string,
    interval: string,
    timestamp: number,
    marketType: 'SPOT' | 'FUTURES'
  ): Promise<BinanceKlineResponse | null> {
    const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
    const url = `${baseUrl}?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${timestamp}&limit=1`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.length === 0) return null;

      const k = data[0];
      return {
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteVolume: k[7],
        trades: k[8],
        takerBuyBaseVolume: k[9],
        takerBuyQuoteVolume: k[10],
      };
    } catch {
      return null;
    }
  }
}
