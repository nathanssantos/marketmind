import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let symbolScoresMock: Array<{
  symbol: string;
  compositeScore: number;
  marketCapRank: number;
  breakdown: {
    marketCapScore: number; volumeScore: number; volatilityScore: number;
    priceChangeScore: number; setupFrequencyScore: number;
    winRateScore: number; profitFactorScore: number;
  };
  rawData: {
    marketCap: number; volume24h: number; priceChange24h: number;
    setupCount7d: number; winRate: number | null; profitFactor: number | null;
  };
}> = [];
let isLoadingScoresMock = false;
let activeWatchersMock: Array<{ symbol: string }> = [];
let rotationHistoryMock: Array<{ added: string[]; removed: string[]; kept: string[]; timestamp: string }> = [];
let isLoadingHistoryMock = false;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; defaultValue?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : opts?.defaultValue ?? key,
  }),
}));

vi.mock('@renderer/hooks/useBackendAutoTrading', () => ({
  useBackendAutoTrading: () => ({
    watcherStatus: { activeWatchers: activeWatchersMock },
  }),
  useDynamicSymbolScores: () => ({
    symbolScores: symbolScoresMock,
    isLoadingScores: isLoadingScoresMock,
  }),
  useRotationHistory: () => ({
    rotationHistory: rotationHistoryMock,
    isLoadingRotationHistory: isLoadingHistoryMock,
  }),
}));

vi.mock('@renderer/hooks/useActiveWallet', () => ({
  useActiveWallet: () => ({ activeWallet: { id: 'w1' } }),
}));

import { DynamicSymbolRankings } from './DynamicSymbolRankings';

const renderRankings = (open = true) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <DynamicSymbolRankings isOpen={open} onClose={vi.fn()} marketType="FUTURES" />
    </ChakraProvider>
  );

const makeScore = (symbol: string): typeof symbolScoresMock[number] => ({
  symbol,
  compositeScore: 75,
  marketCapRank: 1,
  breakdown: {
    marketCapScore: 80, volumeScore: 70, volatilityScore: 60,
    priceChangeScore: 50, setupFrequencyScore: 90,
    winRateScore: 65, profitFactorScore: 75,
  },
  rawData: {
    marketCap: 1_000_000_000, volume24h: 100_000_000, priceChange24h: 1.5,
    setupCount7d: 10, winRate: 0.55, profitFactor: 1.5,
  },
});

describe('DynamicSymbolRankings', () => {
  beforeEach(() => {
    symbolScoresMock = [];
    isLoadingScoresMock = false;
    activeWatchersMock = [];
    rotationHistoryMock = [];
    isLoadingHistoryMock = false;
    vi.clearAllMocks();
  });

  it('does not render when isOpen=false', () => {
    renderRankings(false);
    expect(screen.queryByText('tradingProfiles.dynamicSelection.rankingsTitle')).toBeNull();
  });

  it('shows rankings title when open', () => {
    renderRankings();
    expect(screen.getByText('tradingProfiles.dynamicSelection.rankingsTitle')).toBeDefined();
  });

  it('renders the tab switcher (Rankings + History)', () => {
    renderRankings();
    expect(screen.getByText('tradingProfiles.dynamicSelection.tabRankings')).toBeDefined();
    expect(screen.getByText('tradingProfiles.dynamicSelection.tabHistory')).toBeDefined();
  });

  it('marks symbols with active watcher as Active', () => {
    symbolScoresMock = [makeScore('BTCUSDT'), makeScore('ETHUSDT')];
    activeWatchersMock = [{ symbol: 'BTCUSDT' }];
    renderRankings();
    // Only one symbol has active watcher → at least one "active" badge appears.
    const activeBadges = screen.getAllByText('common.active');
    expect(activeBadges.length).toBe(1);
  });

  it('switches to History tab when its button is clicked', () => {
    rotationHistoryMock = [{
      added: ['SOLUSDT'],
      removed: [],
      kept: ['BTCUSDT'],
      timestamp: '2026-04-20T10:00:00Z',
    }];
    renderRankings();
    fireEvent.click(screen.getByText('tradingProfiles.dynamicSelection.tabHistory'));
    expect(screen.getByText(/SOLUSDT/)).toBeDefined();
  });

  it('shows added pills when history has rotation', () => {
    rotationHistoryMock = [{
      added: ['SOLUSDT', 'AVAXUSDT'],
      removed: [],
      kept: [],
      timestamp: '2026-04-20T10:00:00Z',
    }];
    renderRankings();
    fireEvent.click(screen.getByText('tradingProfiles.dynamicSelection.tabHistory'));
    expect(screen.getByText('SOLUSDT')).toBeDefined();
    expect(screen.getByText('AVAXUSDT')).toBeDefined();
  });

  it('shows removed pills when history has rotation', () => {
    rotationHistoryMock = [{
      added: [],
      removed: ['DOGEUSDT'],
      kept: [],
      timestamp: '2026-04-20T10:00:00Z',
    }];
    renderRankings();
    fireEvent.click(screen.getByText('tradingProfiles.dynamicSelection.tabHistory'));
    expect(screen.getByText('DOGEUSDT')).toBeDefined();
  });
});
