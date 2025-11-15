import { describe, expect, it } from 'vitest';
import { formatPrice, formatTimestamp, formatVolume, formatNumber, formatChartDataContext } from './formatters';
import type { ChartContextData } from '../context/ChartContext';

describe('formatters', () => {
  describe('formatPrice', () => {
    it('should format millions correctly', () => {
      expect(formatPrice(1500000)).toBe('1.50M');
      expect(formatPrice(50000000)).toBe('50.00M');
    });

    it('should format thousands correctly', () => {
      expect(formatPrice(1500)).toBe('1.50K');
      expect(formatPrice(50000)).toBe('50.00K');
    });

    it('should format prices >= 1 with 2 decimals', () => {
      expect(formatPrice(100)).toBe('100.00');
      expect(formatPrice(45.678)).toBe('45.68');
    });

    it('should format prices >= 0.01 with 4 decimals', () => {
      expect(formatPrice(0.5)).toBe('0.5000');
      expect(formatPrice(0.0123)).toBe('0.0123');
    });

    it('should format small prices with 8 decimals', () => {
      expect(formatPrice(0.00000123)).toBe('0.00000123');
      expect(formatPrice(0.000005)).toBe('0.00000500');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('0.00000000');
    });
  });

  describe('formatTimestamp', () => {
    const testDate = new Date('2024-11-15T14:30:00').getTime();

    it('should format minute intervals with time only', () => {
      expect(formatTimestamp(testDate, '1m')).toBe('14:30');
      expect(formatTimestamp(testDate, '5m')).toBe('14:30');
      expect(formatTimestamp(testDate, '15m')).toBe('14:30');
      expect(formatTimestamp(testDate, '30m')).toBe('14:30');
    });

    it('should format hour intervals with date and time', () => {
      expect(formatTimestamp(testDate, '1h')).toBe('15/11 14:30');
      expect(formatTimestamp(testDate, '4h')).toBe('15/11 14:30');
    });

    it('should format day intervals with full date', () => {
      expect(formatTimestamp(testDate, '1d')).toBe('15/11/2024');
      expect(formatTimestamp(testDate, '1w')).toBe('15/11/2024');
      expect(formatTimestamp(testDate, '1M')).toBe('15/11/2024');
    });

    it('should format without interval as full date', () => {
      expect(formatTimestamp(testDate)).toBe('15/11/2024');
    });

    it('should pad single digits with zeros', () => {
      const earlyDate = new Date('2024-01-05T09:05:00').getTime();
      expect(formatTimestamp(earlyDate, '1m')).toBe('09:05');
      expect(formatTimestamp(earlyDate, '1d')).toBe('05/01/2024');
    });
  });

  describe('formatVolume', () => {
    it('should format billions correctly', () => {
      expect(formatVolume(1500000000)).toBe('1.50B');
      expect(formatVolume(50000000000)).toBe('50.00B');
    });

    it('should format millions correctly', () => {
      expect(formatVolume(1500000)).toBe('1.50M');
      expect(formatVolume(50000000)).toBe('50.00M');
    });

    it('should format thousands correctly', () => {
      expect(formatVolume(1500)).toBe('1.50K');
      expect(formatVolume(50000)).toBe('50.00K');
    });

    it('should format small volumes without decimals', () => {
      expect(formatVolume(100)).toBe('100');
      expect(formatVolume(999)).toBe('999');
    });

    it('should handle zero', () => {
      expect(formatVolume(0)).toBe('0');
    });
  });

  describe('formatNumber', () => {
    it('should format with default 2 decimals', () => {
      expect(formatNumber(1234.5678)).toBe('1,234.57');
      expect(formatNumber(1000000)).toBe('1,000,000.00');
    });

    it('should format with custom decimals', () => {
      expect(formatNumber(1234.5678, 0)).toBe('1,235');
      expect(formatNumber(1234.5678, 4)).toBe('1,234.5678');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0.00');
      expect(formatNumber(0, 4)).toBe('0.0000');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1234.56)).toBe('-1,234.56');
    });
  });

  describe('formatChartDataContext', () => {
    const mockCandles = [
      { timestamp: 1700000000000, open: 100, high: 110, low: 95, close: 105, volume: 1000000 },
      { timestamp: 1700000060000, open: 105, high: 115, low: 100, close: 110, volume: 1500000 },
      { timestamp: 1700000120000, open: 110, high: 120, low: 105, close: 115, volume: 2000000 },
      { timestamp: 1700000180000, open: 115, high: 125, low: 110, close: 120, volume: 1800000 },
      { timestamp: 1700000240000, open: 120, high: 130, low: 115, close: 118, volume: 1600000 },
    ];

    it('should handle empty candles', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: [],
        movingAverages: [],
        showVolume: true,
      };

      expect(formatChartDataContext(chartData)).toBe('No chart data available');
    });

    it('should format basic chart information', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('# Chart Analysis Context');
      expect(result).toContain('Symbol: BTCUSDT');
      expect(result).toContain('Timeframe: 1m');
      expect(result).toContain('Chart Type: candlestick');
    });

    it('should calculate price statistics correctly', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Current Price: $118.00');
      expect(result).toContain('High: $120.00');
      expect(result).toContain('Low: $105.00');
    });

    it('should calculate volume statistics', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Volume Analysis');
      expect(result).toContain('Average Volume:');
      expect(result).toContain('Current Volume:');
    });

    it('should detect bullish trend correctly', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Bullish Candles: 4');
      expect(result).toContain('Bearish Candles: 1');
      expect(result).toContain('Overall Trend: Bullish');
    });

    it('should include moving averages when visible', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [
          { period: 20, type: 'SMA', color: '#ff0000', visible: true },
          { period: 50, type: 'EMA', color: '#00ff00', visible: true },
          { period: 100, type: 'SMA', color: '#0000ff', visible: false },
        ],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Moving Averages');
      expect(result).toContain('SMA-20: Active');
      expect(result).toContain('EMA-50: Active');
      expect(result).not.toContain('SMA-100');
    });

    it('should include news when available', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: mockCandles,
        movingAverages: [],
        showVolume: true,
        news: [
          {
            id: '1',
            title: 'Bitcoin reaches new high',
            description: 'Bitcoin price surged to new all-time high today',
            url: 'https://example.com/1',
            source: 'CryptoNews',
            publishedAt: Date.now() - 3600000,
            sentiment: 'positive',
          },
          {
            id: '2',
            title: 'Market correction expected',
            description: 'Analysts predict a market correction',
            url: 'https://example.com/2',
            source: 'MarketWatch',
            publishedAt: Date.now() - 7200000,
            sentiment: 'negative',
          },
        ],
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Recent News (2 articles)');
      expect(result).toContain('News Sentiment Summary');
      expect(result).toContain('Positive: 1');
      expect(result).toContain('Negative: 1');
      expect(result).toContain('Bitcoin reaches new high');
      expect(result).toContain('Market correction expected');
    });

    it('should limit candles to last 100', () => {
      const manyCandles = Array.from({ length: 200 }, (_, i) => ({
        timestamp: 1700000000000 + i * 60000,
        open: 100 + i,
        high: 110 + i,
        low: 95 + i,
        close: 105 + i,
        volume: 1000000 + i * 1000,
      }));

      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'candlestick',
        candles: manyCandles,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Last 100 Candles');
      expect(result).toContain('Current Price: $304.00');
    });
  });
});
