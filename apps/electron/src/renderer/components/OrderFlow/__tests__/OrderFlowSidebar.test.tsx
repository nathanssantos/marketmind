import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui';
import { OrderFlowSidebar } from '../OrderFlowSidebar';
import { useUIStore } from '@renderer/store/uiStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@renderer/hooks/useDepth', () => ({
  useDepth: () => ({ bids: [], asks: [] }),
}));

vi.mock('@renderer/store/priceStore', () => ({
  useFastPriceForSymbol: () => 67950,
}));

vi.mock('@renderer/hooks/useScalpingMetrics', () => ({
  useScalpingMetrics: () => ({
    cvd: 0,
    imbalanceRatio: 0,
    spreadPercent: 0,
    absorptionScore: 0,
    microprice: 0,
    exhaustionScore: 0,
    spread: 0,
    largeBuyVol: 0,
    largeSellVol: 0,
    metricsHistory: () => [],
  }),
}));

const renderWithChakra = (component: React.ReactElement) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>{component}</ColorModeProvider>
    </ChakraProvider>
  );

describe('OrderFlowSidebar', () => {
  beforeEach(() => {
    useUIStore.setState({ orderFlowSidebarOpen: true, orderFlowSidebarTab: 'dom' });
  });

  it('renders nothing when closed', () => {
    useUIStore.setState({ orderFlowSidebarOpen: false });
    const { container } = renderWithChakra(<OrderFlowSidebar width={300} symbol="BTCUSDT" />);
    expect(container.children.length).toBe(0);
  });

  it('renders 2 tab triggers when open', () => {
    renderWithChakra(<OrderFlowSidebar width={300} symbol="BTCUSDT" />);
    expect(screen.getByText('DOM')).toBeDefined();
    expect(screen.getByText('Metrics')).toBeDefined();
  });

  it('renders close button', () => {
    renderWithChakra(<OrderFlowSidebar width={300} symbol="BTCUSDT" />);
    expect(screen.getByLabelText('Close')).toBeDefined();
  });

  it('renders DOM tab content by default', () => {
    renderWithChakra(<OrderFlowSidebar width={300} symbol="BTCUSDT" />);
    expect(screen.getByText('67950.00')).toBeDefined();
  });
});
