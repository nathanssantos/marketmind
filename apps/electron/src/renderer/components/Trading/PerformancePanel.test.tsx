import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformancePanel } from './PerformancePanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const mockPerformance = {
  totalTrades: 21,
  winningTrades: 13,
  losingTrades: 8,
  winRate: 61.9,
  grossPnL: 877.86,
  totalFees: 459.10,
  totalFunding: -42.55,
  netPnL: 418.76,
  avgWin: 59.10,
  avgLoss: -43.68,
  profitFactor: 2.20,
  totalReturn: 4.19,
  largestWin: 181.94,
  largestLoss: -140.93,
  maxDrawdown: 2.36,
  effectiveCapital: 10000,
  totalDeposits: 0,
  totalWithdrawals: 0,
};

const mockUseBackendAnalytics = vi.fn();

vi.mock('../../hooks/useBackendAnalytics', () => ({
  useBackendAnalytics: (...args: unknown[]) => mockUseBackendAnalytics(...args),
}));

const setPeriodMock = vi.fn();
let currentPeriod: 'day' | 'week' | 'month' | 'all' = 'all';

vi.mock('../../store/uiStore', () => ({
  useUIStore: (selector: (state: { performancePeriod: string; setPerformancePeriod: typeof setPeriodMock }) => unknown) =>
    selector({
      performancePeriod: currentPeriod,
      setPerformancePeriod: (p: typeof currentPeriod) => {
        currentPeriod = p;
        setPeriodMock(p);
      },
    }),
}));

vi.mock('../../store/currencyStore', () => ({
  convertUsdtToBrl: (v: number) => v * 5,
  useCurrencyStore: (selector: (state: { usdtBrlRate: number; showBrlValues: boolean }) => unknown) =>
    selector({ usdtBrlRate: 5, showBrlValues: false }),
}));

const renderPanel = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <PerformancePanel walletId="w1" currency="USDT" />
    </ChakraProvider>,
  );

describe('PerformancePanel', () => {
  beforeEach(() => {
    setPeriodMock.mockClear();
    currentPeriod = 'all';
    mockUseBackendAnalytics.mockReset();
  });

  it('renders all 9 metric cards with the expected labels', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: mockPerformance, isLoadingPerformance: false });
    renderPanel();

    expect(screen.getByText('trading.analytics.performance.totalReturn')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.netPnL')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.winRate')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.profitFactor')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.avgWin')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.avgLoss')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.maxDrawdown')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.largestWin')).toBeTruthy();
    expect(screen.getByText('trading.analytics.performance.largestLoss')).toBeTruthy();
  });

  it('shows positive total return with a leading + sign', () => {
    mockUseBackendAnalytics.mockReturnValue({
      performance: { ...mockPerformance, totalReturn: 4.19 },
      isLoadingPerformance: false,
    });
    renderPanel();
    expect(screen.getByText('+4.19%')).toBeTruthy();
  });

  it('shows negative total return without an extra sign', () => {
    mockUseBackendAnalytics.mockReturnValue({
      performance: { ...mockPerformance, totalReturn: -37.86 },
      isLoadingPerformance: false,
    });
    renderPanel();
    expect(screen.getByText('-37.86%')).toBeTruthy();
  });

  it('renders the Net PnL subtext with Gross / Fees / Funding when funding is non-zero', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: mockPerformance, isLoadingPerformance: false });
    renderPanel();
    const subtext = screen.getByText(/Gross:/);
    expect(subtext.textContent).toContain('Gross:');
    expect(subtext.textContent).toContain('Fees:');
    expect(subtext.textContent).toContain('Funding:');
  });

  it('omits the Funding line when totalFunding is exactly zero', () => {
    mockUseBackendAnalytics.mockReturnValue({
      performance: { ...mockPerformance, totalFunding: 0 },
      isLoadingPerformance: false,
    });
    renderPanel();
    const subtext = screen.getByText(/Gross:/);
    expect(subtext.textContent).not.toContain('Funding:');
  });

  it('renders the W/L summary line under Win Rate', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: mockPerformance, isLoadingPerformance: false });
    renderPanel();
    expect(screen.getByText('13W / 8L')).toBeTruthy();
  });

  it('clicking a different period button calls setPerformancePeriod', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: mockPerformance, isLoadingPerformance: false });
    renderPanel();

    fireEvent.click(screen.getByText('trading.analytics.periods.week'));
    expect(setPeriodMock).toHaveBeenCalledWith('week');
  });

  it('shows the spinner while loading and no metric labels', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: undefined, isLoadingPerformance: true });
    renderPanel();
    expect(screen.queryByText('trading.analytics.performance.netPnL')).toBeNull();
  });

  it('shows the no-data message when performance is null/undefined and not loading', () => {
    mockUseBackendAnalytics.mockReturnValue({ performance: undefined, isLoadingPerformance: false });
    renderPanel();
    expect(screen.getByText('trading.analytics.performance.noData')).toBeTruthy();
  });
});
