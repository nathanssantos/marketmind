import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui';
import { OrderFlowMetrics } from '../OrderFlowMetrics';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@renderer/hooks/useScalpingMetrics', () => ({
  useScalpingMetrics: () => ({
    cvd: 123.45,
    imbalanceRatio: 0.567,
    spreadPercent: 0.0012,
    absorptionScore: 0.89,
    microprice: 67950.12,
    exhaustionScore: 0.34,
    spread: 0.5,
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

describe('OrderFlowMetrics', () => {
  it('renders all metric labels', () => {
    renderWithChakra(<OrderFlowMetrics symbol="BTCUSDT" />);
    expect(screen.getByText('CVD')).toBeDefined();
    expect(screen.getByText('Imbalance')).toBeDefined();
    expect(screen.getByText('Spread')).toBeDefined();
    expect(screen.getByText('Absorption')).toBeDefined();
    expect(screen.getByText('Microprice')).toBeDefined();
    expect(screen.getByText('Exhaustion')).toBeDefined();
  });

  it('renders metric values formatted correctly', () => {
    renderWithChakra(<OrderFlowMetrics symbol="BTCUSDT" />);
    expect(screen.getByText('123.45')).toBeDefined();
    expect(screen.getByText('0.567')).toBeDefined();
    expect(screen.getByText('0.0012%')).toBeDefined();
    expect(screen.getByText('0.89')).toBeDefined();
    expect(screen.getByText('67950.12')).toBeDefined();
    expect(screen.getByText('0.34')).toBeDefined();
  });

  it('renders order flow title', () => {
    renderWithChakra(<OrderFlowMetrics symbol="BTCUSDT" />);
    expect(screen.getByText('Order Flow')).toBeDefined();
  });
});
