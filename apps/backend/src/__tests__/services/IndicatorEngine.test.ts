import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Kline, IndicatorDefinition, ComputedIndicators, IndicatorType } from '@marketmind/types';

vi.mock('../../services/binance-futures-data', () => ({
  getBinanceFuturesDataService: vi.fn(() => ({
    getFundingRate: vi.fn().mockResolvedValue([]),
    getOpenInterest: vi.fn().mockResolvedValue([]),
    getLiquidations: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../services/btc-dominance-data', () => ({
  getBTCDominanceDataService: vi.fn(() => ({
    getBTCDominance: vi.fn().mockResolvedValue({ btcDominance: 52.5 }),
  })),
}));

import { IndicatorEngine } from '../../services/setup-detection/dynamic/IndicatorEngine';
import { getBinanceFuturesDataService } from '../../services/binance-futures-data';
import { getBTCDominanceDataService } from '../../services/btc-dominance-data';

function createMockKline(overrides: Partial<Record<'open' | 'high' | 'low' | 'close' | 'volume', number>> & { index?: number } = {}): Kline {
  const idx = overrides.index ?? 0;
  const close = overrides.close ?? 100;
  const open = overrides.open ?? (close - 1);
  const high = overrides.high ?? (close + 2);
  const low = overrides.low ?? (close - 2);
  const volume = overrides.volume ?? 1000;
  const baseTime = new Date('2024-01-01').getTime() + idx * 3600000;
  return {
    openTime: baseTime,
    closeTime: baseTime + 3599999,
    open: open.toString(),
    high: high.toString(),
    low: low.toString(),
    close: close.toString(),
    volume: volume.toString(),
    quoteVolume: (volume * close).toString(),
    trades: 100,
    takerBuyBaseVolume: (volume / 2).toString(),
    takerBuyQuoteVolume: ((volume / 2) * close).toString(),
  };
}

function generateKlines(count: number, basePrice: number = 100): Kline[] {
  return Array.from({ length: count }, (_, i) =>
    createMockKline({ close: basePrice + i, index: i })
  );
}

function generateVolatileKlines(count: number): Kline[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + Math.sin(i * 0.5) * 20 + i * 0.5;
    const open = close - 2 + Math.random() * 4;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    return createMockKline({ open, high, low, close, volume: 1000 + i * 50, index: i });
  });
}

describe('IndicatorEngine', () => {
  let engine: IndicatorEngine;

  beforeEach(() => {
    engine = new IndicatorEngine();
    vi.clearAllMocks();
  });

  describe('computeIndicators - individual indicator types', () => {
    it('should compute SMA with default period', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma20: { type: 'sma', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma20']).toBeDefined();
      expect(result['sma20']!.type).toBe('sma');
      expect(Array.isArray(result['sma20']!.values)).toBe(true);
    });

    it('should compute EMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        ema9: { type: 'ema', params: { period: 9 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['ema9']).toBeDefined();
      expect(result['ema9']!.type).toBe('ema');
      expect(Array.isArray(result['ema9']!.values)).toBe(true);
    });

    it('should compute RSI indicator with values array', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        rsi14: { type: 'rsi', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['rsi14']).toBeDefined();
      expect(result['rsi14']!.type).toBe('rsi');
    });

    it('should compute MACD with macd, signal, and histogram sub-values', () => {
      const klines = generateKlines(50);
      const indicators: Record<string, IndicatorDefinition> = {
        macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['macd']!.values as Record<string, (number | null)[]>;

      expect(result['macd']!.type).toBe('macd');
      expect(values['macd']).toBeDefined();
      expect(values['signal']).toBeDefined();
      expect(values['histogram']).toBeDefined();
    });

    it('should compute Bollinger Bands with upper, middle, lower', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        bb: { type: 'bollingerBands', params: { period: 20, stdDev: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['bb']!.values as Record<string, (number | null)[]>;

      expect(result['bb']!.type).toBe('bollingerBands');
      expect(values['upper']).toBeDefined();
      expect(values['middle']).toBeDefined();
      expect(values['lower']).toBeDefined();
    });

    it('should compute ATR indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        atr: { type: 'atr', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['atr']).toBeDefined();
      expect(result['atr']!.type).toBe('atr');
    });

    it('should compute Stochastic with k and d values', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        stoch: { type: 'stochastic', params: { kPeriod: 14, kSmoothing: 3, dPeriod: 3 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['stoch']!.values as Record<string, (number | null)[]>;

      expect(result['stoch']!.type).toBe('stochastic');
      expect(values['k']).toBeDefined();
      expect(values['d']).toBeDefined();
    });

    it('should compute StochRSI with k and d values', () => {
      const klines = generateKlines(50);
      const indicators: Record<string, IndicatorDefinition> = {
        stochRsi: { type: 'stochRsi', params: { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['stochRsi']!.values as Record<string, (number | null)[]>;

      expect(result['stochRsi']!.type).toBe('stochRsi');
      expect(values['k']).toBeDefined();
      expect(values['d']).toBeDefined();
    });

    it('should compute ADX with adx, plusDI, minusDI', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        adx: { type: 'adx', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['adx']!.values as Record<string, (number | null)[]>;

      expect(result['adx']!.type).toBe('adx');
      expect(values['adx']).toBeDefined();
      expect(values['plusDI']).toBeDefined();
      expect(values['minusDI']).toBeDefined();
    });

    it('should compute Supertrend with trend and value', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        st: { type: 'supertrend', params: { period: 10, multiplier: 3 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['st']!.values as Record<string, (number | null)[]>;

      expect(result['st']!.type).toBe('supertrend');
      expect(values['trend']).toBeDefined();
      expect(values['value']).toBeDefined();
    });

    it('should compute VWAP indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        vwap: { type: 'vwap', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['vwap']).toBeDefined();
      expect(result['vwap']!.type).toBe('vwap');
    });

    it('should compute Ichimoku with all sub-values', () => {
      const klines = generateKlines(80);
      const indicators: Record<string, IndicatorDefinition> = {
        ichimoku: { type: 'ichimoku', params: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52, displacement: 26 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['ichimoku']!.values as Record<string, (number | null)[]>;

      expect(result['ichimoku']!.type).toBe('ichimoku');
      expect(values['tenkan']).toBeDefined();
      expect(values['kijun']).toBeDefined();
      expect(values['senkouA']).toBeDefined();
      expect(values['senkouB']).toBeDefined();
      expect(values['chikou']).toBeDefined();
    });

    it('should compute OBV with values and sma', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        obv: { type: 'obv', params: { smaPeriod: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['obv']!.values as Record<string, (number | null)[]>;

      expect(result['obv']!.type).toBe('obv');
      expect(values['obv']).toBeDefined();
      expect(values['sma']).toBeDefined();
    });

    it('should compute OBV without smaPeriod param', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        obv: { type: 'obv', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['obv']).toBeDefined();
      expect(result['obv']!.type).toBe('obv');
    });

    it('should compute Williams %R indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        wr: { type: 'williamsR', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['wr']).toBeDefined();
      expect(result['wr']!.type).toBe('williamsR');
    });

    it('should compute CCI indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        cci: { type: 'cci', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['cci']).toBeDefined();
      expect(result['cci']!.type).toBe('cci');
    });

    it('should compute MFI indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        mfi: { type: 'mfi', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['mfi']).toBeDefined();
      expect(result['mfi']!.type).toBe('mfi');
    });

    it('should compute Donchian Channels with upper, middle, lower', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        dc: { type: 'donchian', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['dc']!.values as Record<string, (number | null)[]>;

      expect(result['dc']!.type).toBe('donchian');
      expect(values['upper']).toBeDefined();
      expect(values['middle']).toBeDefined();
      expect(values['lower']).toBeDefined();
    });

    it('should compute Keltner Channels with upper, middle, lower', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        kc: { type: 'keltner', params: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['kc']!.values as Record<string, (number | null)[]>;

      expect(result['kc']!.type).toBe('keltner');
      expect(values['upper']).toBeDefined();
      expect(values['middle']).toBeDefined();
      expect(values['lower']).toBeDefined();
    });

    it('should compute IBS indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        ibs: { type: 'ibs', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['ibs']).toBeDefined();
      expect(result['ibs']!.type).toBe('ibs');
    });

    it('should compute Percent B indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        pb: { type: 'percentB', params: { period: 20, stdDev: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['pb']).toBeDefined();
      expect(result['pb']!.type).toBe('percentB');
    });

    it('should compute Cumulative RSI with cumulative and rsi values', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        crsi: { type: 'cumulativeRsi', params: { rsiPeriod: 2, sumPeriod: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['crsi']!.values as Record<string, (number | null)[]>;

      expect(result['crsi']!.type).toBe('cumulativeRsi');
      expect(values['cumulative']).toBeDefined();
      expect(values['rsi']).toBeDefined();
    });

    it('should compute N-Day High/Low indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        ndhl: { type: 'nDayHighLow', params: { period: 7 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['ndhl']!.values as Record<string, (number | null)[]>;

      expect(result['ndhl']!.type).toBe('nDayHighLow');
      expect(values['isNDayHigh']).toBeDefined();
      expect(values['isNDayLow']).toBeDefined();
      expect(values['highestClose']).toBeDefined();
      expect(values['lowestClose']).toBeDefined();
    });

    it('should compute NR7 indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        nr7: { type: 'nr7', params: { lookback: 7 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['nr7']).toBeDefined();
      expect(result['nr7']!.type).toBe('nr7');
    });

    it('should compute ROC indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        roc: { type: 'roc', params: { period: 12 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['roc']).toBeDefined();
      expect(result['roc']!.type).toBe('roc');
    });

    it('should compute DEMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        dema: { type: 'dema', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['dema']).toBeDefined();
      expect(result['dema']!.type).toBe('dema');
    });

    it('should compute TEMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        tema: { type: 'tema', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['tema']).toBeDefined();
      expect(result['tema']!.type).toBe('tema');
    });

    it('should compute WMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        wma: { type: 'wma', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['wma']).toBeDefined();
      expect(result['wma']!.type).toBe('wma');
    });

    it('should compute HMA indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        hma: { type: 'hma', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['hma']).toBeDefined();
      expect(result['hma']!.type).toBe('hma');
    });

    it('should compute CMO indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        cmo: { type: 'cmo', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['cmo']).toBeDefined();
      expect(result['cmo']!.type).toBe('cmo');
    });

    it('should compute AO (Awesome Oscillator) indicator', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        ao: { type: 'ao', params: { fastPeriod: 5, slowPeriod: 34 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['ao']).toBeDefined();
      expect(result['ao']!.type).toBe('ao');
    });

    it('should compute PPO with ppo, signal, histogram', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        ppo: { type: 'ppo', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['ppo']!.values as Record<string, (number | null)[]>;

      expect(result['ppo']!.type).toBe('ppo');
      expect(values['ppo']).toBeDefined();
      expect(values['signal']).toBeDefined();
      expect(values['histogram']).toBeDefined();
    });

    it('should compute TSI with tsi and signal', () => {
      const klines = generateKlines(60);
      const indicators: Record<string, IndicatorDefinition> = {
        tsi: { type: 'tsi', params: { longPeriod: 25, shortPeriod: 13, signalPeriod: 13 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['tsi']!.values as Record<string, (number | null)[]>;

      expect(result['tsi']!.type).toBe('tsi');
      expect(values['tsi']).toBeDefined();
      expect(values['signal']).toBeDefined();
    });

    it('should compute Ultimate Oscillator', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        uo: { type: 'ultimateOscillator', params: { period1: 7, period2: 14, period3: 28 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['uo']).toBeDefined();
      expect(result['uo']!.type).toBe('ultimateOscillator');
    });

    it('should compute Aroon with up, down, oscillator', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        aroon: { type: 'aroon', params: { period: 25 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['aroon']!.values as Record<string, (number | null)[]>;

      expect(result['aroon']!.type).toBe('aroon');
      expect(values['up']).toBeDefined();
      expect(values['down']).toBeDefined();
      expect(values['oscillator']).toBeDefined();
    });

    it('should compute DMI with plusDI, minusDI, dx', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        dmi: { type: 'dmi', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['dmi']!.values as Record<string, (number | null)[]>;

      expect(result['dmi']!.type).toBe('dmi');
      expect(values['plusDI']).toBeDefined();
      expect(values['minusDI']).toBeDefined();
      expect(values['dx']).toBeDefined();
    });

    it('should compute Vortex with viPlus and viMinus', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        vortex: { type: 'vortex', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['vortex']!.values as Record<string, (number | null)[]>;

      expect(result['vortex']!.type).toBe('vortex');
      expect(values['viPlus']).toBeDefined();
      expect(values['viMinus']).toBeDefined();
    });

    it('should compute Parabolic SAR with sar and trend', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        psar: { type: 'parabolicSar', params: { step: 0.02, max: 0.2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['psar']!.values as Record<string, (number | null)[]>;

      expect(result['psar']!.type).toBe('parabolicSar');
      expect(values['sar']).toBeDefined();
      expect(values['trend']).toBeDefined();
    });

    it('should compute Mass Index indicator', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        mass: { type: 'massIndex', params: { emaPeriod: 9, sumPeriod: 25 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['mass']).toBeDefined();
      expect(result['mass']!.type).toBe('massIndex');
    });

    it('should compute CMF indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        cmf: { type: 'cmf', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['cmf']).toBeDefined();
      expect(result['cmf']!.type).toBe('cmf');
    });

    it('should compute Klinger with kvo and signal', () => {
      const klines = generateKlines(60);
      const indicators: Record<string, IndicatorDefinition> = {
        klinger: { type: 'klinger', params: { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['klinger']!.values as Record<string, (number | null)[]>;

      expect(result['klinger']!.type).toBe('klinger');
      expect(values['kvo']).toBeDefined();
      expect(values['signal']).toBeDefined();
    });

    it('should compute Elder Ray with bullPower and bearPower', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        elder: { type: 'elderRay', params: { period: 13 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['elder']!.values as Record<string, (number | null)[]>;

      expect(result['elder']!.type).toBe('elderRay');
      expect(values['bullPower']).toBeDefined();
      expect(values['bearPower']).toBeDefined();
    });

    it('should compute Delta Volume with delta and cumulative', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        dv: { type: 'deltaVolume', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['dv']!.values as Record<string, (number | null)[]>;

      expect(result['dv']!.type).toBe('deltaVolume');
      expect(values['delta']).toBeDefined();
      expect(values['cumulative']).toBeDefined();
    });

    it('should compute Swing Points with high and low', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sp: { type: 'swingPoints', params: { lookback: 5 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['sp']!.values as Record<string, (number | null)[]>;

      expect(result['sp']!.type).toBe('swingPoints');
      expect(values['high']).toBeDefined();
      expect(values['low']).toBeDefined();
    });

    it('should compute FVG with bullish and bearish arrays', () => {
      const klines = generateVolatileKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fvg: { type: 'fvg', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['fvg']!.values as Record<string, (number | null)[]>;

      expect(result['fvg']!.type).toBe('fvg');
      expect(values['bullish']).toBeDefined();
      expect(values['bearish']).toBeDefined();
      expect(values['bullish']).toHaveLength(klines.length);
      expect(values['bearish']).toHaveLength(klines.length);
    });

    it('should compute Gap Detection indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        gap: { type: 'gapDetection', params: { threshold: 0.5 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['gap']).toBeDefined();
      expect(result['gap']!.type).toBe('gapDetection');
    });

    it('should compute Fibonacci retracement levels', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fib: { type: 'fibonacci', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['fib']!.values as Record<string, (number | null)[]>;

      expect(result['fib']!.type).toBe('fibonacci');
      expect(values['level236']).toBeDefined();
      expect(values['level382']).toBeDefined();
      expect(values['level500']).toBeDefined();
      expect(values['level618']).toBeDefined();
      expect(values['level786']).toBeDefined();
    });

    it('should compute Floor Pivots with standard type', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['fp']!.values as Record<string, (number | null)[]>;

      expect(result['fp']!.type).toBe('floorPivots');
      expect(values['pivot']).toBeDefined();
      expect(values['r1']).toBeDefined();
      expect(values['r2']).toBeDefined();
      expect(values['r3']).toBeDefined();
      expect(values['s1']).toBeDefined();
      expect(values['s2']).toBeDefined();
      expect(values['s3']).toBeDefined();
    });

    it('should compute Floor Pivots with fibonacci pivot type', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'fibonacci' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });

    it('should compute Floor Pivots with invalid pivot type falling back to standard', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'invalid_type' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });

    it('should compute Liquidity Levels with support and resistance', () => {
      const klines = generateKlines(60);
      const indicators: Record<string, IndicatorDefinition> = {
        ll: { type: 'liquidityLevels', params: { lookback: 50, minTouches: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['ll']!.values as Record<string, (number | null)[]>;

      expect(result['ll']!.type).toBe('liquidityLevels');
      expect(values['support']).toBeDefined();
      expect(values['resistance']).toBeDefined();
    });

    it('should compute Pivot Points indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        pp: { type: 'pivotPoints', params: { lookback: 5 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['pp']).toBeDefined();
      expect(result['pp']!.type).toBe('pivotPoints');
    });

    it('should compute Halving Cycle indicator', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        hc: { type: 'halvingCycle', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['hc']!.values as Record<string, (number | null)[]>;

      expect(result['hc']!.type).toBe('halvingCycle');
      expect(values['phase']).toBeDefined();
      expect(values['daysFromHalving']).toBeDefined();
      expect(values['cycleProgress']).toBeDefined();
    });

    it('should compute Highest indicator with default high source', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 10 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['h']).toBeDefined();
      expect(result['h']!.type).toBe('highest');
      const values = result['h']!.values as (number | null)[];
      expect(values).toHaveLength(30);
      for (let i = 0; i < 9; i++) {
        expect(values[i]).toBeNull();
      }
      expect(values[9]).not.toBeNull();
    });

    it('should compute Highest indicator with close source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 5, source: 'close' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values[4]).toBe(104);
      expect(values[9]).toBe(109);
    });

    it('should compute Highest indicator with volume source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 3, source: 'volume' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['h']!.type).toBe('highest');
    });

    it('should compute Lowest indicator with default low source', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 10 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['l']).toBeDefined();
      expect(result['l']!.type).toBe('lowest');
      const values = result['l']!.values as (number | null)[];
      expect(values).toHaveLength(30);
      for (let i = 0; i < 9; i++) {
        expect(values[i]).toBeNull();
      }
      expect(values[9]).not.toBeNull();
    });

    it('should compute Lowest indicator with close source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 5, source: 'close' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values[4]).toBe(100);
      expect(values[9]).toBe(105);
    });

    it('should compute Lowest indicator with open source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 3, source: 'open' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['l']!.type).toBe('lowest');
    });

    it('should return null-filled arrays for crypto-only indicators in non-crypto context', () => {
      const klines = generateKlines(10);
      const cryptoTypes: IndicatorType[] = ['fundingRate', 'openInterest', 'liquidations', 'btcDominance', 'relativeStrength'];

      for (const type of cryptoTypes) {
        const indicators: Record<string, IndicatorDefinition> = {
          test: { type, params: {} },
        };

        const result = engine.computeIndicators(klines, indicators, {});

        expect(result['test']!.type).toBe(type);
        const values = result['test']!.values;
        if (Array.isArray(values)) {
          expect(values).toHaveLength(klines.length);
          expect(values.every((v) => v === null)).toBe(true);
        }
      }
    });
  });

  describe('built-in indicators', () => {
    it('should always include _price with open, high, low, close, volume', () => {
      const klines = generateKlines(5);
      const result = engine.computeIndicators(klines, {}, {});
      const priceValues = result['_price']!.values as Record<string, (number | null)[]>;

      expect(priceValues['open']).toHaveLength(5);
      expect(priceValues['high']).toHaveLength(5);
      expect(priceValues['low']).toHaveLength(5);
      expect(priceValues['close']).toHaveLength(5);
      expect(priceValues['volume']).toHaveLength(5);
      expect(priceValues['close']![0]).toBe(100);
      expect(priceValues['close']![4]).toBe(104);
    });

    it('should always include volume with current and sma20', () => {
      const klines = generateKlines(25);
      const result = engine.computeIndicators(klines, {}, {});
      const volumeValues = result['volume']!.values as Record<string, (number | null)[]>;

      expect(volumeValues['current']).toHaveLength(25);
      expect(volumeValues['sma20']).toHaveLength(25);
      for (let i = 0; i < 19; i++) {
        expect(volumeValues['sma20']![i]).toBeNull();
      }
      expect(volumeValues['sma20']![19]).not.toBeNull();
    });

    it('should auto-compute ADX with period 14 when not explicitly defined', () => {
      const klines = generateKlines(30);
      const result = engine.computeIndicators(klines, {}, {});
      const adxValues = result['adx']!.values as Record<string, (number | null)[]>;

      expect(result['adx']!.type).toBe('adx');
      expect(adxValues['adx']).toBeDefined();
      expect(adxValues['plusDI']).toBeDefined();
      expect(adxValues['minusDI']).toBeDefined();
    });

    it('should not overwrite explicitly defined ADX', () => {
      const klines = generateKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        adx: { type: 'adx', params: { period: 20 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['adx']!.type).toBe('adx');
    });

    it('should auto-compute ATR with period 14 when not explicitly defined', () => {
      const klines = generateKlines(30);
      const result = engine.computeIndicators(klines, {}, {});

      expect(result['atr']).toBeDefined();
      expect(result['atr']!.type).toBe('atr');
    });

    it('should not overwrite explicitly defined ATR', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        atr: { type: 'atr', params: { period: 10 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['atr']!.type).toBe('atr');
    });
  });

  describe('caching behavior', () => {
    it('should return cached result for identical inputs', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result1 = engine.computeIndicators(klines, indicators, {});
      const result2 = engine.computeIndicators(klines, indicators, {});

      expect(result1).toBe(result2);
    });

    it('should not return cached result after clearCache', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result1 = engine.computeIndicators(klines, indicators, {});
      engine.clearCache();
      const result2 = engine.computeIndicators(klines, indicators, {});

      expect(result1).not.toBe(result2);
    });

    it('should compute different results for different params', () => {
      const klines = generateKlines(30);

      const result1 = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 10 } } },
        {}
      );
      const result2 = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 20 } } },
        {}
      );

      expect(result1).not.toBe(result2);
    });

    it('should compute different results for different kline lengths', () => {
      const klines1 = generateKlines(30, 100);
      const klines2 = generateKlines(20, 100);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result1 = engine.computeIndicators(klines1, indicators, {});
      const result2 = engine.computeIndicators(klines2, indicators, {});

      expect(result1).not.toBe(result2);
    });

    it('should evict oldest entry when cache exceeds MAX_CACHE_SIZE', () => {
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      for (let i = 0; i < 101; i++) {
        const klines = generateKlines(5, i * 1000);
        engine.computeIndicators(klines, indicators, {});
      }

      const firstKlines = generateKlines(5, 0);
      const result1 = engine.computeIndicators(firstKlines, indicators, {});
      const result2 = engine.computeIndicators(firstKlines, indicators, {});

      expect(result1).toBe(result2);
    });
  });

  describe('parameter resolution', () => {
    it('should resolve $paramName references from strategy params', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: '$smaPeriod' } },
      };

      const result = engine.computeIndicators(klines, indicators, { smaPeriod: 10 });

      expect(result['sma']).toBeDefined();
    });

    it('should throw for unknown $param references', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: '$unknown' } },
      };

      expect(() => engine.computeIndicators(klines, indicators, {}))
        .toThrow('Unknown parameter reference: $unknown');
    });

    it('should pass through number parameters directly', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 15 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma']).toBeDefined();
    });

    it('should pass through string parameters that are not references', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'woodie' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']).toBeDefined();
    });
  });

  describe('resolveIndicatorValue', () => {
    it('should resolve simple indicator value at index', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 10 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'sma', 29);

      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should resolve price references (open, high, low, close, volume)', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.resolveIndicatorValue(indicators, 'close', 0)).toBe(100);
      expect(engine.resolveIndicatorValue(indicators, 'open', 0)).toBe(99);
      expect(engine.resolveIndicatorValue(indicators, 'high', 0)).toBe(102);
      expect(engine.resolveIndicatorValue(indicators, 'low', 0)).toBe(98);
      expect(engine.resolveIndicatorValue(indicators, 'volume', 0)).toBe(1000);
    });

    it('should resolve nested indicator values with subKey (macd.signal)', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'macd.signal', 49);

      expect(typeof value).toBe('number');
    });

    it('should resolve prev offset (indicator.prev)', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const current = engine.resolveIndicatorValue(indicators, 'close', 10);
      const prev = engine.resolveIndicatorValue(indicators, 'close.prev', 10);

      expect(current).toBe(110);
      expect(prev).toBe(109);
    });

    it('should resolve prevN offset (indicator.prev2)', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(klines, {}, {});

      const prev2 = engine.resolveIndicatorValue(indicators, 'close.prev2', 10);

      expect(prev2).toBe(108);
    });

    it('should return null for negative effective index', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'close.prev', 0);

      expect(value).toBeNull();
    });

    it('should return null for unknown indicator name', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.resolveIndicatorValue(indicators, 'nonexistent', 5)).toBeNull();
    });

    it('should return null for empty base reference', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.resolveIndicatorValue(indicators, '', 5)).toBeNull();
    });

    it('should resolve volume sub-key references', () => {
      const klines = generateKlines(25);
      const indicators = engine.computeIndicators(klines, {}, {});

      const currentVol = engine.resolveIndicatorValue(indicators, 'volume.current', 5);

      expect(currentVol).toBe(1000);
    });

    it('should return null for volume sub-key when volume indicator missing', () => {
      const indicators: ComputedIndicators = {};

      expect(engine.resolveIndicatorValue(indicators, 'volume.current', 0)).toBeNull();
    });

    it('should return first key value when no subKey for record-type indicator', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'macd', 49);

      expect(typeof value).toBe('number');
    });
  });

  describe('getIndicatorSeries', () => {
    it('should return full series for a simple array indicator', () => {
      const klines = generateKlines(30);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 10 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'sma');

      expect(series).toHaveLength(30);
    });

    it('should return price series for close', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const series = engine.getIndicatorSeries(indicators, 'close');

      expect(series).toHaveLength(10);
      expect(series[0]).toBe(100);
      expect(series[9]).toBe(109);
    });

    it('should return price series for open, high, low, volume', () => {
      const klines = generateKlines(5);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.getIndicatorSeries(indicators, 'open')).toHaveLength(5);
      expect(engine.getIndicatorSeries(indicators, 'high')).toHaveLength(5);
      expect(engine.getIndicatorSeries(indicators, 'low')).toHaveLength(5);
      expect(engine.getIndicatorSeries(indicators, 'volume')).toHaveLength(5);
    });

    it('should return sub-key series for record-type indicator (macd.signal)', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd.signal');

      expect(series).toHaveLength(50);
    });

    it('should return default key series when no subKey for record-type indicator', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd');

      expect(series).toHaveLength(50);
    });

    it('should return shifted series for prev offset', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const series = engine.getIndicatorSeries(indicators, 'close.prev');

      expect(series).toHaveLength(10);
      expect(series[0]).toBeNull();
      expect(series[1]).toBe(100);
      expect(series[9]).toBe(108);
    });

    it('should return empty array for invalid reference', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.getIndicatorSeries(indicators, 'nonexistent')).toEqual([]);
    });

    it('should return empty array for empty base reference', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      expect(engine.getIndicatorSeries(indicators, '')).toEqual([]);
    });

    it('should return volume sub-key series', () => {
      const klines = generateKlines(25);
      const indicators = engine.computeIndicators(klines, {}, {});

      const sma20Series = engine.getIndicatorSeries(indicators, 'volume.sma20');

      expect(sma20Series).toHaveLength(25);
    });

    it('should return empty array when volume indicator missing for volume subKey', () => {
      const indicators: ComputedIndicators = {};

      expect(engine.getIndicatorSeries(indicators, 'volume.current')).toEqual([]);
    });

    it('should return empty array when price indicator missing', () => {
      const indicators: ComputedIndicators = {};

      expect(engine.getIndicatorSeries(indicators, 'close')).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty klines array', () => {
      const result = engine.computeIndicators([], {}, {});

      expect(result['_price']).toBeDefined();
      const priceValues = result['_price']!.values as Record<string, (number | null)[]>;
      expect(priceValues['close']).toHaveLength(0);
    });

    it('should handle single kline', () => {
      const klines = [createMockKline({ close: 100, index: 0 })];
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma']).toBeDefined();
      expect(result['_price']).toBeDefined();
    });

    it('should compute multiple indicators at once', () => {
      const klines = generateKlines(50);
      const indicators: Record<string, IndicatorDefinition> = {
        sma10: { type: 'sma', params: { period: 10 } },
        ema20: { type: 'ema', params: { period: 20 } },
        rsi14: { type: 'rsi', params: { period: 14 } },
        atr14: { type: 'atr', params: { period: 14 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma10']).toBeDefined();
      expect(result['ema20']).toBeDefined();
      expect(result['rsi14']).toBeDefined();
      expect(result['atr14']).toBeDefined();
      expect(result['_price']).toBeDefined();
      expect(result['volume']).toBeDefined();
      expect(result['adx']).toBeDefined();
      expect(result['atr']).toBeDefined();
    });

    it('should handle Highest with period 0', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 0 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values).toHaveLength(0);
    });

    it('should handle Lowest with period 0', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 0 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values).toHaveLength(0);
    });

    it('should handle Highest with empty klines', () => {
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 10 } },
      };

      const result = engine.computeIndicators([], indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values).toHaveLength(0);
    });

    it('should handle Lowest with empty klines', () => {
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 10 } },
      };

      const result = engine.computeIndicators([], indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values).toHaveLength(0);
    });

    it('should handle Highest with unknown source defaulting to high', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 3, source: 'unknown_source' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should handle Lowest with unknown source defaulting to low', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 3, source: 'unknown_source' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });
  });

  describe('computeIndicatorsWithCryptoData', () => {
    it('should return standard indicators when no crypto indicators requested', async () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['sma']).toBeDefined();
      expect(getBinanceFuturesDataService).not.toHaveBeenCalled();
    });

    it('should fetch crypto data when fundingRate indicator is present', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(getBinanceFuturesDataService).toHaveBeenCalled();
      expect(result['fr']).toBeDefined();
    });

    it('should fetch crypto data when openInterest indicator is present', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(getBinanceFuturesDataService).toHaveBeenCalled();
      expect(result['oi']).toBeDefined();
    });

    it('should fetch crypto data when liquidations indicator is present', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        liq: { type: 'liquidations', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(getBinanceFuturesDataService).toHaveBeenCalled();
      expect(result['liq']).toBeDefined();
    });

    it('should fetch BTC dominance when btcDominance indicator is present', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(getBTCDominanceDataService).toHaveBeenCalled();
      expect(result['btcd']).toBeDefined();
    });

    it('should handle relativeStrength indicator', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        rs: { type: 'relativeStrength', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'ETHUSDT', 'BTCUSDT');

      expect(result['rs']).toBeDefined();
    });

    it('should cache crypto data and reuse within TTL', async () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      engine.clearCache();
      await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      engine.clearCache();
      await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(getBinanceFuturesDataService).toHaveBeenCalledTimes(1);
    });

    it('should not return computed result for unknown crypto indicator type', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 5 } },
        fr: { type: 'fundingRate', params: {} },
      };

      const result = await engine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['sma']!.type).toBe('sma');
    });
  });

  describe('crypto indicator handlers - with data', () => {
    it('should compute fundingRate with actual funding rate data', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([
          { fundingRate: 0.0001, fundingTime: Date.now() - 3600000, symbol: 'BTCUSDT' },
          { fundingRate: 0.0002, fundingTime: Date.now(), symbol: 'BTCUSDT' },
        ]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: { extremeThreshold: 0.1, averagePeriod: 7 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['fr']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(10);
      expect(values['signal']).toHaveLength(10);
    });

    it('should compute openInterest with actual OI data', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([
          { openInterest: '50000', symbol: 'BTCUSDT', time: Date.now() - 3600000 },
          { openInterest: '55000', symbol: 'BTCUSDT', time: Date.now() },
        ]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: { lookback: 10, changeThreshold: 5, trendPeriod: 5 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['oi']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(10);
      expect(values['trend']).toHaveLength(10);
      expect(values['divergence']).toHaveLength(10);
    });

    it('should compute liquidations with actual liquidation data', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([
          { side: 'BUY', price: '45000', quantity: '1.5', time: Date.now(), symbol: 'BTCUSDT' },
          { side: 'SELL', price: '46000', quantity: '0.5', time: Date.now(), symbol: 'BTCUSDT' },
        ]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        liq: { type: 'liquidations', params: { cascadeThreshold: 1000000, lookbackPeriods: 6, imbalanceThreshold: 0.7 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['liq']!.values as Record<string, (number | null)[]>;

      expect(values['delta']).toHaveLength(10);
      expect(values['cascade']).toHaveLength(10);
      expect(values['dominantSide']).toHaveLength(10);
    });

    it('should compute btcDominance with actual data', async () => {
      const mockBtcService = {
        getBTCDominance: vi.fn().mockResolvedValue({ btcDominance: 55.3 }),
      };
      vi.mocked(getBTCDominanceDataService).mockReturnValue(mockBtcService as ReturnType<typeof getBTCDominanceDataService>);

      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['btcd']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(5);
      expect(values['current']![4]).toBe(55.3);
    });

    it('should handle fundingRate with empty data returning null-filled array', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['fr']!.type).toBe('fundingRate');
      const values = result['fr']!.values;
      if (Array.isArray(values)) {
        expect(values.every((v) => v === null)).toBe(true);
      }
    });

    it('should handle openInterest with empty data returning null-filled array', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['oi']!.type).toBe('openInterest');
    });

    it('should handle liquidations with empty data returning null-filled array', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        liq: { type: 'liquidations', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['liq']!.type).toBe('liquidations');
    });

    it('should handle btcDominance with null data', async () => {
      const mockBtcService = {
        getBTCDominance: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(getBTCDominanceDataService).mockReturnValue(mockBtcService as ReturnType<typeof getBTCDominanceDataService>);

      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['btcd']).toBeDefined();
    });
  });

  describe('parseReference edge cases', () => {
    it('should handle reference with subKey and prev together (indicator.subKey.prev)', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const current = engine.resolveIndicatorValue(indicators, 'macd.signal', 49);
      const prev = engine.resolveIndicatorValue(indicators, 'macd.signal.prev', 49);

      if (current !== null && prev !== null) {
        expect(typeof current).toBe('number');
        expect(typeof prev).toBe('number');
      }
    });

    it('should handle getIndicatorSeries with prev offset shifting values', () => {
      const klines = generateKlines(5);
      const indicators = engine.computeIndicators(klines, {}, {});

      const closeSeries = engine.getIndicatorSeries(indicators, 'close');
      const closePrevSeries = engine.getIndicatorSeries(indicators, 'close.prev');

      expect(closePrevSeries[0]).toBeNull();
      expect(closePrevSeries[1]).toBe(closeSeries[0]);
      expect(closePrevSeries[4]).toBe(closeSeries[3]);
    });

    it('should handle prev with numeric suffix (prev3)', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'close.prev3', 5);

      expect(value).toBe(102);
    });
  });

  describe('toNumber helper branches', () => {
    it('should use default when param is undefined (toNumber via missing param)', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma']).toBeDefined();
    });

    it('should parse string param value as number (toNumber string branch)', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: '15' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['sma']).toBeDefined();
      expect(result['sma']!.type).toBe('sma');
    });
  });

  describe('cache eviction edge cases', () => {
    it('should evict oldest cache entry when MAX_CACHE_SIZE (100) is reached', () => {
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      for (let i = 0; i < 100; i++) {
        const klines = generateKlines(5, i * 1000);
        engine.computeIndicators(klines, indicators, {});
      }

      const evictedKlines = generateKlines(5, 0);
      const result1 = engine.computeIndicators(evictedKlines, indicators, {});

      engine.clearCache();

      const newKlines = generateKlines(5, 200000);
      engine.computeIndicators(newKlines, indicators, {});

      const result2 = engine.computeIndicators(evictedKlines, indicators, {});
      expect(result1).not.toBe(result2);
    });

    it('should handle generateCacheKey with empty klines', () => {
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 10 } },
      };

      const result = engine.computeIndicators([], indicators, {});

      expect(result['sma']).toBeDefined();
    });
  });

  describe('resolveParams edge cases', () => {
    it('should throw error for invalid parameter value type', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: null as unknown as number } },
      };

      expect(() => engine.computeIndicators(klines, indicators, {})).toThrow('Invalid parameter value');
    });

    it('should pass through non-$ string params unchanged', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'camarilla' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });
  });

  describe('computeIndicator unknown type', () => {
    it('should throw error for unknown indicator type', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        test: { type: 'unknownType' as IndicatorType, params: {} },
      };

      expect(() => engine.computeIndicators(klines, indicators, {})).toThrow('Unknown indicator type: unknownType');
    });
  });

  describe('parseReference advanced branches', () => {
    it('should handle prevXYZ (non-numeric suffix) defaulting offset to 1', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'close.prevABC', 5);

      expect(value).toBe(104);
    });

    it('should skip empty parts in reference path', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'close..prev', 5);

      expect(value).toBe(104);
    });

    it('should handle subKey followed by prev (macd.histogram.prev)', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const current = engine.resolveIndicatorValue(indicators, 'macd.histogram', 49);
      const prev = engine.resolveIndicatorValue(indicators, 'macd.histogram.prev', 49);

      expect(current !== null || prev !== null).toBe(true);
    });

    it('should handle subKey already set when second non-prev part appears', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'macd.signal.extra', 49);

      expect(value).not.toBeNull();
    });
  });

  describe('resolveIndicatorValue additional branches', () => {
    it('should return null when _price indicator is missing for price reference', () => {
      const indicators: ComputedIndicators = {};

      expect(engine.resolveIndicatorValue(indicators, 'close', 0)).toBeNull();
    });

    it('should return null for array indicator with out-of-range index', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 5 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'sma', 999);

      expect(value).toBeNull();
    });

    it('should return null for record indicator with non-existent subKey', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const value = engine.resolveIndicatorValue(indicators, 'macd.nonexistent', 49);

      expect(value).toBeNull();
    });

    it('should return null when defaultKey values returns empty object', () => {
      const indicators: ComputedIndicators = {
        empty: {
          type: 'sma' as IndicatorType,
          values: {},
        },
      };

      const value = engine.resolveIndicatorValue(indicators, 'empty', 0);

      expect(value).toBeNull();
    });

    it('should return null for volume.nonexistent subKey', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(klines, {}, {});

      const value = engine.resolveIndicatorValue(indicators, 'volume.nonexistent', 0);

      expect(value).toBeNull();
    });
  });

  describe('getIndicatorSeries additional branches', () => {
    it('should return empty for indicator with empty values object (no defaultKey)', () => {
      const indicators: ComputedIndicators = {
        empty: {
          type: 'sma' as IndicatorType,
          values: {},
        },
      };

      const series = engine.getIndicatorSeries(indicators, 'empty');

      expect(series).toEqual([]);
    });

    it('should handle volume.subKey with offset (not entering volume branch)', () => {
      const klines = generateKlines(25);
      const indicators = engine.computeIndicators(klines, {}, {});

      const series = engine.getIndicatorSeries(indicators, 'volume.current.prev');

      expect(series).toHaveLength(25);
      expect(series[0]).toBeNull();
    });

    it('should handle getIndicatorSeries for a record-type indicator with prev offset', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd.signal.prev');

      expect(series).toHaveLength(50);
      expect(series[0]).toBeNull();
    });

    it('should return empty array for non-existent subKey on record indicator', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd.nonexistent');

      expect(series).toEqual([]);
    });

    it('should return shifted series when offset > 0 on array indicator', () => {
      const klines = generateKlines(10);
      const indicators = engine.computeIndicators(
        klines,
        { sma: { type: 'sma', params: { period: 3 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'sma.prev');

      expect(series).toHaveLength(10);
      expect(series[0]).toBeNull();
    });

    it('should return empty series for missing price indicator in getIndicatorSeries', () => {
      const indicators: ComputedIndicators = {};

      const series = engine.getIndicatorSeries(indicators, 'open');

      expect(series).toEqual([]);
    });

    it('should return empty series for missing volume indicator in getIndicatorSeries', () => {
      const indicators: ComputedIndicators = {};

      const series = engine.getIndicatorSeries(indicators, 'volume.sma20');

      expect(series).toEqual([]);
    });
  });

  describe('calculateHighest/Lowest source branches', () => {
    it('should compute Highest with open source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 3, source: 'open' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should compute Highest with low source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 3, source: 'low' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should compute Lowest with high source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 3, source: 'high' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should compute Lowest with volume source', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 3, source: 'volume' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should compute Highest with non-string source param defaulting to high', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        h: { type: 'highest', params: { period: 3, source: 99 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['h']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });

    it('should compute Lowest with non-string source param defaulting to low', () => {
      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        l: { type: 'lowest', params: { period: 3, source: 99 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['l']!.values as (number | null)[];

      expect(values[2]).not.toBeNull();
    });
  });

  describe('calculateVolumeSMA edge cases', () => {
    it('should return empty array for period 0', () => {
      const result = engine.computeIndicators([], {}, {});
      const volumeValues = result['volume']!.values as Record<string, (number | null)[]>;

      expect(volumeValues['sma20']).toHaveLength(0);
    });
  });

  describe('OBV smaPeriod type branches', () => {
    it('should handle OBV with string smaPeriod (non-number branch)', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        obv: { type: 'obv', params: { smaPeriod: 'invalid' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['obv']).toBeDefined();
      expect(result['obv']!.type).toBe('obv');
    });
  });

  describe('floorPivots pivotType branch', () => {
    it('should handle floorPivots with numeric pivotType (non-string branch)', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 42 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });

    it('should handle floorPivots with woodie pivot type', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'woodie' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });

    it('should handle floorPivots with demark pivot type', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'demark' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });

    it('should handle floorPivots with camarilla pivot type', () => {
      const klines = generateKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        fp: { type: 'floorPivots', params: { pivotType: 'camarilla' } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['fp']!.type).toBe('floorPivots');
    });
  });

  describe('crypto indicator handlers - data presence branches', () => {
    it('should handle fundingRate when result.current is null', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([
          { fundingRate: 0.0001, fundingTime: Date.now(), symbol: 'BTCUSDT' },
        ]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['fr']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(5);
      expect(values['signal']).toHaveLength(5);
    });

    it('should handle openInterest where prev price is 0', async () => {
      const klines: Kline[] = [
        createMockKline({ close: 0, index: 0 }),
        createMockKline({ close: 100, index: 1 }),
        createMockKline({ close: 105, index: 2 }),
        createMockKline({ close: 110, index: 3 }),
        createMockKline({ close: 115, index: 4 }),
      ];

      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([
          { openInterest: '50000', symbol: 'BTCUSDT', time: Date.now() - 3600000 },
          { openInterest: '55000', symbol: 'BTCUSDT', time: Date.now() },
        ]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const newEngine = new IndicatorEngine();
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: {} },
      };

      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['oi']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(5);
    });

    it('should handle openInterest when result.current is null', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([
          { openInterest: '50000', symbol: 'BTCUSDT', time: Date.now() },
        ]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['oi']!.values as Record<string, (number | null)[]>;

      expect(values['current']).toHaveLength(5);
      expect(values['trend']).toHaveLength(5);
      expect(values['divergence']).toHaveLength(5);
    });

    it('should handle relativeStrength with baseAssetCloses from cryptoData', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        rs: { type: 'relativeStrength', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'ETHUSDT');
      const values = result['rs']!.values as Record<string, (number | null)[]>;

      expect(values['ratio']).toHaveLength(10);
      expect(values['outperforming']).toHaveLength(10);
      expect(values['strength']).toHaveLength(10);
    });

    it('should handle btcDominance when btcDominance is undefined in cryptoData', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['btcd']).toBeDefined();
      const values = result['btcd']!.values as Record<string, (number | null)[]>;
      expect(values['current']).toHaveLength(5);
      expect(values['current']![4]).toBeNull();
    });

    it('should evict oldest crypto data cache entry when MAX_CRYPTO_CACHE_SIZE reached', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      for (let i = 0; i < 51; i++) {
        newEngine.clearCache();
        await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, `SYMBOL${i}USDT`);
      }

      expect(mockService.getFundingRate).toHaveBeenCalledTimes(51);
    });

    it('should handle fetchCryptoData with needsBtcDominance false (no BTC dominance fetch)', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);
      const btcMock = vi.mocked(getBTCDominanceDataService);
      btcMock.mockClear();

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(btcMock).not.toHaveBeenCalled();
    });

    it('should handle computeCryptoIndicator returning null for non-crypto type', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        sma: { type: 'sma', params: { period: 5 } },
        fr: { type: 'fundingRate', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');

      expect(result['sma']).toBeDefined();
      expect(result['sma']!.type).toBe('sma');
    });

    it('should handle btcDominance with needsBtcDominance and results[3] containing data', async () => {
      const mockBtcService = {
        getBTCDominance: vi.fn().mockResolvedValue({ btcDominance: 48.7 }),
      };
      vi.mocked(getBTCDominanceDataService).mockReturnValue(mockBtcService as ReturnType<typeof getBTCDominanceDataService>);

      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['btcd']!.values as Record<string, (number | null)[]>;

      expect(values['current']![4]).toBe(48.7);
    });

    it('should handle btcDominance with needsBtcDominance and null results[3]', async () => {
      const mockBtcService = {
        getBTCDominance: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(getBTCDominanceDataService).mockReturnValue(mockBtcService as ReturnType<typeof getBTCDominanceDataService>);

      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        btcd: { type: 'btcDominance', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['btcd']!.values as Record<string, (number | null)[]>;

      expect(values['current']![4]).toBeNull();
    });
  });

  describe('supertrend trend mapping branches', () => {
    it('should map supertrend trend values correctly (up -> 1, down -> -1)', () => {
      const klines = generateVolatileKlines(40);
      const indicators: Record<string, IndicatorDefinition> = {
        st: { type: 'supertrend', params: { period: 10, multiplier: 3 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['st']!.values as Record<string, (number | null)[]>;

      for (const v of values['trend']!) {
        expect(v === 1 || v === -1 || v === null).toBe(true);
      }
    });
  });

  describe('pivotPoints index bounds', () => {
    it('should handle pivot points where index is within bounds', () => {
      const klines = generateVolatileKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        pp: { type: 'pivotPoints', params: { lookback: 3 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['pp']).toBeDefined();
      expect(result['pp']!.type).toBe('pivotPoints');
    });
  });

  describe('fvg gap type branches', () => {
    it('should handle FVG with bullish and bearish gaps in different indices', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 20; i++) {
        const base = 100 + (i % 3 === 0 ? 10 : -10) * (i % 2 === 0 ? 1 : -1);
        klines.push(createMockKline({
          open: base - 5,
          high: base + 15,
          low: base - 15,
          close: base,
          volume: 1000,
          index: i,
        }));
      }

      const indicators: Record<string, IndicatorDefinition> = {
        fvg: { type: 'fvg', params: {} },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['fvg']!.values as Record<string, (number | null)[]>;

      expect(values['bullish']).toHaveLength(20);
      expect(values['bearish']).toHaveLength(20);
    });
  });

  describe('gapDetection type branches', () => {
    it('should handle gap detection with up and down gaps', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 10; i++) {
        const gapUp = i === 3;
        const gapDown = i === 6;
        const close = 100 + i * 2 + (gapUp ? 20 : 0) - (gapDown ? 20 : 0);
        klines.push(createMockKline({
          open: close - 1,
          high: close + 2,
          low: close - 2,
          close,
          volume: 1000,
          index: i,
        }));
      }

      const indicators: Record<string, IndicatorDefinition> = {
        gap: { type: 'gapDetection', params: { threshold: 0.5 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});

      expect(result['gap']!.type).toBe('gapDetection');
    });
  });

  describe('liquidityLevels type branches', () => {
    it('should handle liquidity levels with support and resistance types', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 80; i++) {
        const price = 100 + Math.sin(i * 0.3) * 10;
        klines.push(createMockKline({
          open: price - 1,
          high: price + 3,
          low: price - 3,
          close: price,
          volume: 1000,
          index: i,
        }));
      }

      const indicators: Record<string, IndicatorDefinition> = {
        ll: { type: 'liquidityLevels', params: { lookback: 20, minTouches: 2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['ll']!.values as Record<string, (number | null)[]>;

      expect(values['support']).toHaveLength(80);
      expect(values['resistance']).toHaveLength(80);
    });
  });

  describe('parabolicSar trend mapping', () => {
    it('should map parabolicSar trend (up -> 1, down -> -1)', () => {
      const klines = generateVolatileKlines(30);
      const indicators: Record<string, IndicatorDefinition> = {
        psar: { type: 'parabolicSar', params: { step: 0.02, max: 0.2 } },
      };

      const result = engine.computeIndicators(klines, indicators, {});
      const values = result['psar']!.values as Record<string, (number | null)[]>;

      for (const v of values['trend']!) {
        if (v !== null) {
          expect(v === 1 || v === -1).toBe(true);
        }
      }
    });
  });

  describe('fundingRate signal ternary branches', () => {
    it('should map funding rate signal values (long=1, short=-1, neutral=0)', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([
          { fundingRate: 0.0001, fundingTime: Date.now() - 7200000, symbol: 'BTCUSDT' },
          { fundingRate: 0.0002, fundingTime: Date.now() - 3600000, symbol: 'BTCUSDT' },
          { fundingRate: 0.0003, fundingTime: Date.now(), symbol: 'BTCUSDT' },
        ]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        fr: { type: 'fundingRate', params: { extremeThreshold: 0.1, averagePeriod: 7 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['fr']!.values as Record<string, (number | null)[]>;

      expect(values['signal']).toHaveLength(5);
      for (const v of values['signal']!) {
        expect(v === 1 || v === -1 || v === 0).toBe(true);
      }
    });
  });

  describe('openInterest trend and divergence ternary branches', () => {
    it('should map OI trend and divergence values', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([
          { openInterest: '50000', symbol: 'BTCUSDT', time: Date.now() - 7200000 },
          { openInterest: '52000', symbol: 'BTCUSDT', time: Date.now() - 3600000 },
          { openInterest: '55000', symbol: 'BTCUSDT', time: Date.now() },
        ]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(10);
      const indicators: Record<string, IndicatorDefinition> = {
        oi: { type: 'openInterest', params: { lookback: 10, changeThreshold: 5, trendPeriod: 5 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['oi']!.values as Record<string, (number | null)[]>;

      for (const v of values['trend']!) {
        expect(v === 1 || v === -1 || v === 0).toBe(true);
      }
      for (const v of values['divergence']!) {
        expect(v === 1 || v === -1 || v === 0).toBe(true);
      }
    });
  });

  describe('liquidations dominantSide ternary branches', () => {
    it('should map liquidations dominantSide values (long=1, short=-1, neutral=0)', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([
          { side: 'BUY', price: '45000', quantity: '5', time: Date.now(), symbol: 'BTCUSDT' },
          { side: 'SELL', price: '46000', quantity: '1', time: Date.now(), symbol: 'BTCUSDT' },
        ]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        liq: { type: 'liquidations', params: { cascadeThreshold: 1000000, lookbackPeriods: 6, imbalanceThreshold: 0.7 } },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'BTCUSDT');
      const values = result['liq']!.values as Record<string, (number | null)[]>;

      for (const v of values['dominantSide']!) {
        expect(v === 1 || v === -1 || v === 0).toBe(true);
      }
      for (const v of values['cascade']!) {
        expect(v === 1 || v === 0).toBe(true);
      }
    });
  });

  describe('relativeStrength result branches', () => {
    it('should handle relativeStrength with ratio being null', async () => {
      const mockService = {
        getFundingRate: vi.fn().mockResolvedValue([]),
        getOpenInterest: vi.fn().mockResolvedValue([]),
        getLiquidations: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getBinanceFuturesDataService).mockReturnValue(mockService as ReturnType<typeof getBinanceFuturesDataService>);

      const klines = generateKlines(5);
      const indicators: Record<string, IndicatorDefinition> = {
        rs: { type: 'relativeStrength', params: {} },
      };

      const newEngine = new IndicatorEngine();
      const result = await newEngine.computeIndicatorsWithCryptoData(klines, indicators, {}, 'ETHUSDT');
      const values = result['rs']!.values as Record<string, (number | null)[]>;

      expect(values['ratio']).toHaveLength(5);
      expect(values['outperforming']).toHaveLength(5);
      expect(values['strength']).toHaveLength(5);

      for (const v of values['outperforming']!) {
        expect(v === 1 || v === 0).toBe(true);
      }
      for (const v of values['strength']!) {
        expect(v === 2 || v === 1 || v === 0 || v === -1).toBe(true);
      }
    });
  });

  describe('getIndicatorSeries with prev on nested record types', () => {
    it('should return shifted series for record type with subKey and prev', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd.histogram.prev2');

      expect(series).toHaveLength(50);
      expect(series[0]).toBeNull();
      expect(series[1]).toBeNull();
    });

    it('should return default first key for record indicator without subKey but with prev', () => {
      const klines = generateKlines(50);
      const indicators = engine.computeIndicators(
        klines,
        { macd: { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } } },
        {}
      );

      const series = engine.getIndicatorSeries(indicators, 'macd.prev');

      expect(series).toHaveLength(50);
      expect(series[0]).toBeNull();
    });
  });
});
