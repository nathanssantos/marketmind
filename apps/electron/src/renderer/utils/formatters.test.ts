import { describe, expect, it } from 'vitest';
import type { ChartContextData } from '../context/ChartContext';
import { formatChartDataContext, formatChartPrice, formatDateTimeTooltip, formatNumber, formatPriceDisplay, formatTimestamp, formatVolumeDisplay, getChartPriceDecimals } from './formatters';

describe('formatters', () => {
  describe('formatPriceDisplay', () => {
    it('should format millions correctly', () => {
      expect(formatPriceDisplay(1500000)).toBe('1.50M');
      expect(formatPriceDisplay(50000000)).toBe('50.00M');
    });

    it('should format thousands correctly', () => {
      expect(formatPriceDisplay(1500)).toBe('1.50K');
      expect(formatPriceDisplay(50000)).toBe('50.00K');
    });

    it('should format prices >= 1 with 2 decimals', () => {
      expect(formatPriceDisplay(100)).toBe('100.00');
      expect(formatPriceDisplay(45.678)).toBe('45.68');
    });

    it('should format prices >= 0.01 with 4 decimals', () => {
      expect(formatPriceDisplay(0.5)).toBe('0.5000');
      expect(formatPriceDisplay(0.0123)).toBe('0.0123');
    });

    it('should format small prices with 8 decimals', () => {
      expect(formatPriceDisplay(0.00000123)).toBe('0.00000123');
      expect(formatPriceDisplay(0.000005)).toBe('0.00000500');
    });

    it('should handle zero', () => {
      expect(formatPriceDisplay(0)).toBe('0.00000000');
    });
  });

  describe('getChartPriceDecimals', () => {
    it('should return 2 decimals for prices >= 100', () => {
      expect(getChartPriceDecimals(100)).toBe(2);
      expect(getChartPriceDecimals(1000)).toBe(2);
      expect(getChartPriceDecimals(42000)).toBe(2);
    });

    it('should return 3 decimals for prices >= 1 and < 100', () => {
      expect(getChartPriceDecimals(1)).toBe(3);
      expect(getChartPriceDecimals(50)).toBe(3);
      expect(getChartPriceDecimals(99.99)).toBe(3);
    });

    it('should return 4 decimals for prices >= 0.1 and < 1', () => {
      expect(getChartPriceDecimals(0.1)).toBe(4);
      expect(getChartPriceDecimals(0.5)).toBe(4);
      expect(getChartPriceDecimals(0.38)).toBe(4);
    });

    it('should return 5 decimals for prices >= 0.01 and < 0.1', () => {
      expect(getChartPriceDecimals(0.01)).toBe(5);
      expect(getChartPriceDecimals(0.05)).toBe(5);
    });

    it('should return 6 decimals for prices < 0.01', () => {
      expect(getChartPriceDecimals(0.001)).toBe(6);
      expect(getChartPriceDecimals(0.00001)).toBe(6);
    });
  });

  describe('formatChartPrice', () => {
    it('should format high prices with 2 decimals', () => {
      expect(formatChartPrice(42000.123)).toBe('42000.12');
      expect(formatChartPrice(100.12)).toBe('100.12');
    });

    it('should format medium prices with 3 decimals', () => {
      expect(formatChartPrice(50.1234)).toBe('50.123');
      expect(formatChartPrice(1.5678)).toBe('1.568');
    });

    it('should format low prices with 4 decimals', () => {
      expect(formatChartPrice(0.3794)).toBe('0.3794');
      expect(formatChartPrice(0.5)).toBe('0.5000');
    });

    it('should format very low prices with more decimals', () => {
      expect(formatChartPrice(0.05123)).toBe('0.05123');
      expect(formatChartPrice(0.001234)).toBe('0.001234');
    });
  });

  describe('formatTimestamp', () => {
    const testDate = new Date('2024-11-15T14:30:00').getTime();
    const prevSameDay = new Date('2024-11-15T12:00:00').getTime();
    const prevDiffDay = new Date('2024-11-14T14:00:00').getTime();

    it('should format minute intervals with time only on same day', () => {
      expect(formatTimestamp(testDate, '1m', prevSameDay)).toBe('14:30');
      expect(formatTimestamp(testDate, '5m', prevSameDay)).toBe('14:30');
      expect(formatTimestamp(testDate, '15m', prevSameDay)).toBe('14:30');
      expect(formatTimestamp(testDate, '30m', prevSameDay)).toBe('14:30');
    });

    it('should format minute intervals with date on different day', () => {
      expect(formatTimestamp(testDate, '1m', prevDiffDay)).toBe('15/11 14:30');
      expect(formatTimestamp(testDate, '5m', prevDiffDay)).toBe('15/11 14:30');
    });

    it('should format hour intervals with hour only on same day', () => {
      expect(formatTimestamp(testDate, '1h', prevSameDay)).toBe('14h');
      expect(formatTimestamp(testDate, '4h', prevSameDay)).toBe('14h');
    });

    it('should format hour intervals with date on different day', () => {
      expect(formatTimestamp(testDate, '1h', prevDiffDay)).toBe('15/11 14h');
      expect(formatTimestamp(testDate, '4h', prevDiffDay)).toBe('15/11 14h');
    });

    it('should format day intervals with date only on same year', () => {
      const prevSameYear = new Date('2024-10-01T10:00:00').getTime();
      expect(formatTimestamp(testDate, '1d', prevSameYear)).toBe('15/11');
      expect(formatTimestamp(testDate, '3d', prevSameYear)).toBe('15/11');
    });

    it('should format day intervals with full date on different year', () => {
      const prevDiffYear = new Date('2023-12-31T10:00:00').getTime();
      expect(formatTimestamp(testDate, '1d', prevDiffYear)).toBe('15/11/2024');
    });

    it('should format week and month intervals with month/year', () => {
      expect(formatTimestamp(testDate, '1w')).toBe('11/2024');
      expect(formatTimestamp(testDate, '1M')).toBe('11/2024');
    });

    it('should format without interval as full date', () => {
      expect(formatTimestamp(testDate)).toBe('15/11/2024');
    });

    it('should pad single digits with zeros', () => {
      const earlyDate = new Date('2024-01-05T09:05:00').getTime();
      expect(formatTimestamp(earlyDate, '1m')).toBe('09:05');
      expect(formatTimestamp(earlyDate, '1d')).toBe('05/01');
    });
  });

  describe('formatDateTimeTooltip', () => {
    it('should format date and time with seconds', () => {
      const testDate = new Date('2024-11-15T14:30:45').getTime();
      expect(formatDateTimeTooltip(testDate)).toBe('15/11/2024 14:30:45');
    });

    it('should accept Date object', () => {
      const testDate = new Date('2024-01-05T09:05:03');
      expect(formatDateTimeTooltip(testDate)).toBe('05/01/2024 09:05:03');
    });

    it('should pad single digits with zeros', () => {
      const earlyDate = new Date('2024-01-05T09:05:03').getTime();
      expect(formatDateTimeTooltip(earlyDate)).toBe('05/01/2024 09:05:03');
    });

    it('should handle midnight correctly', () => {
      const midnight = new Date('2024-12-31T00:00:00').getTime();
      expect(formatDateTimeTooltip(midnight)).toBe('31/12/2024 00:00:00');
    });
  });

  describe('formatVolumeDisplay', () => {
    it('should format billions correctly', () => {
      expect(formatVolumeDisplay(1500000000)).toBe('1.50B');
      expect(formatVolumeDisplay(50000000000)).toBe('50.00B');
    });

    it('should format millions correctly', () => {
      expect(formatVolumeDisplay(1500000)).toBe('1.50M');
      expect(formatVolumeDisplay(50000000)).toBe('50.00M');
    });

    it('should format thousands correctly', () => {
      expect(formatVolumeDisplay(1500)).toBe('1.50K');
      expect(formatVolumeDisplay(50000)).toBe('50.00K');
    });

    it('should format small volumes without decimals', () => {
      expect(formatVolumeDisplay(100)).toBe('100');
      expect(formatVolumeDisplay(999)).toBe('999');
    });

    it('should handle zero', () => {
      expect(formatVolumeDisplay(0)).toBe('0');
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
    const mockKlines = [
      { openTime: 1700000000000, closeTime: 1700000060000, open: '100', high: '110', low: '95', close: '105', volume: '1000000', quoteVolume: '105000000', trades: 1000, takerBuyBaseVolume: '500000', takerBuyQuoteVolume: '52500000' },
      { openTime: 1700000060000, closeTime: 1700000120000, open: '105', high: '115', low: '100', close: '110', volume: '1500000', quoteVolume: '165000000', trades: 1500, takerBuyBaseVolume: '750000', takerBuyQuoteVolume: '82500000' },
      { openTime: 1700000120000, closeTime: 1700000180000, open: '110', high: '120', low: '105', close: '115', volume: '2000000', quoteVolume: '230000000', trades: 2000, takerBuyBaseVolume: '1000000', takerBuyQuoteVolume: '115000000' },
      { openTime: 1700000180000, closeTime: 1700000240000, open: '115', high: '125', low: '110', close: '120', volume: '1800000', quoteVolume: '216000000', trades: 1800, takerBuyBaseVolume: '900000', takerBuyQuoteVolume: '108000000' },
      { openTime: 1700000240000, closeTime: 1700000300000, open: '120', high: '130', low: '115', close: '118', volume: '1600000', quoteVolume: '188800000', trades: 1600, takerBuyBaseVolume: '800000', takerBuyQuoteVolume: '94400000' },
    ];

    it('should handle empty klines', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'kline',
        klines: [],
        movingAverages: [],
        showVolume: true,
      };

      expect(formatChartDataContext(chartData)).toBe('No chart data available');
    });

    it('should format basic chart information', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'kline',
        klines: mockKlines,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('# Chart Analysis Context');
      expect(result).toContain('Symbol: BTCUSDT');
      expect(result).toContain('Timeframe: 1m');
      expect(result).toContain('Chart Type: kline');
    });

    it('should calculate price statistics correctly', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'kline',
        klines: mockKlines,
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
        chartType: 'kline',
        klines: mockKlines,
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
        chartType: 'kline',
        klines: mockKlines,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Bullish Klines: 4');
      expect(result).toContain('Bearish Klines: 1');
      expect(result).toContain('Overall Trend: Bullish');
    });

    it('should include moving averages when visible', () => {
      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'kline',
        klines: mockKlines,
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

    it('should limit klines to last 100', () => {
      const manyKlines = Array.from({ length: 200 }, (_, i) => ({
        openTime: 1700000000000 + i * 60000,
        closeTime: 1700000000000 + (i + 1) * 60000,
        open: (100 + i).toString(),
        high: (110 + i).toString(),
        low: (95 + i).toString(),
        close: (105 + i).toString(),
        volume: (1000000 + i * 1000).toString(),
        quoteVolume: '105000000',
        trades: 100,
        takerBuyBaseVolume: '500000',
        takerBuyQuoteVolume: '52500000',
      }));

      const chartData: ChartContextData = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        chartType: 'kline',
        klines: manyKlines,
        movingAverages: [],
        showVolume: true,
      };

      const result = formatChartDataContext(chartData);

      expect(result).toContain('Last 100 Klines');
      expect(result).toContain('Current Price: $304.00');
    });
  });
});
