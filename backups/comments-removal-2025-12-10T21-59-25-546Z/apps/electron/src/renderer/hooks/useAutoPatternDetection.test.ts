import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '../../shared/types';
import { useChartContext } from '../context/ChartContext';
import { useUIStore } from '../store/uiStore';
import { patternDetectionService } from '../utils/patternDetection';
import { useAutoPatternDetection } from './useAutoPatternDetection';

vi.mock('../context/ChartContext');
vi.mock('../store/uiStore');
vi.mock('../utils/patternDetection');

describe('useAutoPatternDetection', () => {
  const mockKlines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
    openTime: 1000000 + i * 60000,
    closeTime: 1000000 + (i + 1) * 60000,
    open: (100 + i).toString(),
    high: (105 + i).toString(),
    low: (95 + i).toString(),
    close: (102 + i).toString(),
    volume: '1000',
    quoteVolume: '102000',
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '51000',
  }));

  const mockSetDetectedPatterns = vi.fn();
  const mockDetectPatterns = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useChartContext).mockReturnValue({
      chartData: {
        symbol: 'BTCUSDT',
        klines: mockKlines,
        timeframe: '1h',
        chartType: 'kline',
        showVolume: true,
        movingAverages: [],
      },
      setChartData: vi.fn(),
      detectedPatterns: [],
      setDetectedPatterns: mockSetDetectedPatterns,
    });

    vi.mocked(useUIStore).mockReturnValue({
      patternDetectionMode: 'algorithmic-only',
      algorithmicDetectionSettings: {
        minConfidence: 0.7,
        pivotSensitivity: 5,
        enabledPatterns: ['support', 'resistance'],
        autoDisplayPatterns: true,
      },
      setAlgorithmicDetectionSettings: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      sidebarWidth: 300,
      setSidebarWidth: vi.fn(),
      newsEnabled: false,
      setNewsEnabled: vi.fn(),
      eventsEnabled: false,
      setEventsEnabled: vi.fn(),
      updateAlgorithmicDetectionSettings: vi.fn(),
    });

    vi.mocked(patternDetectionService.detectPatterns).mockImplementation(mockDetectPatterns);
    mockDetectPatterns.mockResolvedValue({
      patterns: [
        {
          type: 'support',
          points: [
            { openTime: 1000000, price: 100 },
            { openTime: 1060000, price: 100 },
          ],
          confidence: 0.8,
        },
      ],
      metadata: {
        pivotsFound: 10,
        patternsDetected: 1,
        executionTime: 50,
        klinesAnalyzed: 100,
      },
    });
  });

  it('should detect patterns when autoDisplayPatterns is enabled', async () => {
    renderHook(() => useAutoPatternDetection());

    await waitFor(() => {
      expect(mockDetectPatterns).toHaveBeenCalled();
    });

    expect(mockSetDetectedPatterns).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'support',
          confidence: 0.8,
        }),
      ])
    );
  });

  it('should not detect patterns when autoDisplayPatterns is disabled', async () => {
    vi.mocked(useUIStore).mockReturnValue({
      patternDetectionMode: 'algorithmic-only',
      algorithmicDetectionSettings: {
        minConfidence: 0.7,
        pivotSensitivity: 5,
        enabledPatterns: ['support'],
        autoDisplayPatterns: false,
      },
      setAlgorithmicDetectionSettings: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      sidebarWidth: 300,
      setSidebarWidth: vi.fn(),
      newsEnabled: false,
      setNewsEnabled: vi.fn(),
      eventsEnabled: false,
      setEventsEnabled: vi.fn(),
      updateAlgorithmicDetectionSettings: vi.fn(),
    });

    renderHook(() => useAutoPatternDetection());

    await waitFor(() => {
      expect(mockSetDetectedPatterns).toHaveBeenCalledWith([]);
    });

    expect(mockDetectPatterns).not.toHaveBeenCalled();
  });

  it('should re-detect when enabledPatterns changes', async () => {
    const { rerender } = renderHook(() => useAutoPatternDetection());

    await waitFor(() => {
      expect(mockDetectPatterns).toHaveBeenCalledTimes(1);
    });

    vi.mocked(useUIStore).mockReturnValue({
      patternDetectionMode: 'algorithmic-only',
      algorithmicDetectionSettings: {
        minConfidence: 0.7,
        pivotSensitivity: 5,
        enabledPatterns: ['support', 'resistance', 'trendline-bullish'],
        autoDisplayPatterns: true,
      },
      setAlgorithmicDetectionSettings: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      sidebarWidth: 300,
      setSidebarWidth: vi.fn(),
      newsEnabled: false,
      setNewsEnabled: vi.fn(),
      eventsEnabled: false,
      setEventsEnabled: vi.fn(),
      updateAlgorithmicDetectionSettings: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      expect(mockDetectPatterns).toHaveBeenCalledTimes(2);
    });
  });

  it('should pass correct options to pattern detection service', async () => {
    renderHook(() => useAutoPatternDetection());

    await waitFor(() => {
      expect(mockDetectPatterns).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          minConfidence: 0.7,
          enabledPatterns: ['support', 'resistance'],
          pivotOptions: {
            lookback: 5,
            lookahead: 5,
          },
        })
      );
    });
  });

  it('should clear patterns when autoDisplayPatterns is disabled', async () => {
    const { rerender } = renderHook(() => useAutoPatternDetection());

    await waitFor(() => {
      expect(mockDetectPatterns).toHaveBeenCalled();
    });

    vi.mocked(useUIStore).mockReturnValue({
      patternDetectionMode: 'hybrid',
      algorithmicDetectionSettings: {
        minConfidence: 0.7,
        pivotSensitivity: 5,
        enabledPatterns: ['support'],
        autoDisplayPatterns: false,
      },
      setAlgorithmicDetectionSettings: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
      sidebarWidth: 300,
      setSidebarWidth: vi.fn(),
      newsEnabled: false,
      setNewsEnabled: vi.fn(),
      eventsEnabled: false,
      setEventsEnabled: vi.fn(),
      updateAlgorithmicDetectionSettings: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      expect(mockSetDetectedPatterns).toHaveBeenCalledWith([]);
    });
  });
});
