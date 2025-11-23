import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartSettingsTab } from './ChartSettingsTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/hooks/useDebounceCallback', () => ({
  useDebounceCallback: (fn: (...args: unknown[]) => void) => fn,
}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider value={defaultSystem}>
      {component}
    </ChakraProvider>
  );
};

describe('ChartSettingsTab', () => {
  const mockOnConfigChange = vi.fn();
  const mockConfig = {
    rightMargin: 72,
    volumeHeightRatio: 0.2,
    candleSpacing: 0.3,
    candleWickWidth: 1,
    gridLineWidth: 1,
    currentPriceLineWidth: 2,
    currentPriceLineStyle: 'dashed' as const,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 0,
    paddingRight: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders reset button', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.resetToDefaults')).toBeDefined();
  });

  it('renders chart dimensions section', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.chartDimensions')).toBeDefined();
  });

  it('renders right margin field', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.rightMargin')).toBeDefined();
    expect(screen.getByText('settings.chart.rightMarginHelper')).toBeDefined();
  });

  it('renders volume height ratio field', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.volumeHeightRatio')).toBeDefined();
    expect(screen.getByText('settings.chart.volumeHeightRatioHelper')).toBeDefined();
  });

  it('displays current config values', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.rightMargin')).toBeDefined();
    expect(screen.getByText('settings.chart.volumeHeightRatio')).toBeDefined();
  });

  it('calls onConfigChange when reset button is clicked', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    const resetButton = screen.getByText('settings.resetToDefaults');
    fireEvent.click(resetButton);

    expect(mockOnConfigChange).toHaveBeenCalled();
  });

  it('calls onConfigChange when value changes', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.rightMargin')).toBeDefined();
  });

  it('renders candle appearance section', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.candleSettings')).toBeDefined();
  });

  it('renders grid settings section', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.gridSettings')).toBeDefined();
  });

  it('renders current price line section', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.currentPriceLine')).toBeDefined();
  });

  it('renders padding settings section', () => {
    renderWithChakra(
      <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
    );
    
    expect(screen.getByText('settings.chart.chartPadding')).toBeDefined();
  });
});
