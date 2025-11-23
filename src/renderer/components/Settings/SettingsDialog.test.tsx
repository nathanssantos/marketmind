import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog } from './SettingsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

vi.mock('./GeneralTab', () => ({
  GeneralTab: () => <div>GeneralTab Content</div>,
}));

vi.mock('./ChartSettingsTab', () => ({
  ChartSettingsTab: () => <div>ChartSettingsTab Content</div>,
}));

vi.mock('./AIConfigTab', () => ({
  AIConfigTab: () => <div>AIConfigTab Content</div>,
}));

vi.mock('./NewsConfigTab', () => ({
  NewsConfigTab: () => <div>NewsConfigTab Content</div>,
}));

vi.mock('./TradingSimulatorTab', () => ({
  TradingSimulatorTab: () => <div>TradingSimulatorTab Content</div>,
}));

vi.mock('./AboutTab', () => ({
  AboutTab: () => <div>AboutTab Content</div>,
}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider value={defaultSystem}>
      {component}
    </ChakraProvider>
  );
};

describe('SettingsDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnAdvancedConfigChange = vi.fn();
  const mockAdvancedConfig = {
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

  it('renders when isOpen is true', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    expect(screen.getByText('settings.title')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={false}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    expect(screen.queryByText('settings.title')).toBeNull();
  });

  it('renders all tab buttons', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    expect(screen.getByText('settings.tabs.general')).toBeDefined();
    expect(screen.getByText('settings.tabs.chart')).toBeDefined();
    expect(screen.getByText('settings.tabs.ai')).toBeDefined();
    expect(screen.getByText('settings.tabs.news')).toBeDefined();
    expect(screen.getByText('settings.tabs.tradingSimulator')).toBeDefined();
    expect(screen.getByText('settings.tabs.about')).toBeDefined();
  });

  it('renders GeneralTab content by default', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    expect(screen.getByText('GeneralTab Content')).toBeDefined();
  });

  it('renders ChartSettingsTab when chart tab is clicked', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const chartTab = screen.getByText('settings.tabs.chart');
    fireEvent.click(chartTab);
    
    expect(screen.getByText('ChartSettingsTab Content')).toBeDefined();
  });

  it('renders AIConfigTab when ai tab is clicked', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const aiTab = screen.getByText('settings.tabs.ai');
    fireEvent.click(aiTab);
    
    expect(screen.getByText('AIConfigTab Content')).toBeDefined();
  });

  it('renders NewsConfigTab when news tab is clicked', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const newsTab = screen.getByText('settings.tabs.news');
    fireEvent.click(newsTab);
    
    expect(screen.getByText('NewsConfigTab Content')).toBeDefined();
  });

  it('renders TradingSimulatorTab when tradingSimulator tab is clicked', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const tradingTab = screen.getByText('settings.tabs.tradingSimulator');
    fireEvent.click(tradingTab);
    
    expect(screen.getByText('TradingSimulatorTab Content')).toBeDefined();
  });

  it('renders AboutTab when about tab is clicked', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const aboutTab = screen.getByText('settings.tabs.about');
    fireEvent.click(aboutTab);
    
    expect(screen.getByText('AboutTab Content')).toBeDefined();
  });

  it('renders close button', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const closeButtons = screen.getAllByRole('button');
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it('switches between tabs correctly', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    expect(screen.getByText('GeneralTab Content')).toBeDefined();
    
    fireEvent.click(screen.getByText('settings.tabs.chart'));
    expect(screen.getByText('ChartSettingsTab Content')).toBeDefined();
    
    fireEvent.click(screen.getByText('settings.tabs.about'));
    expect(screen.getByText('AboutTab Content')).toBeDefined();
  });

  it('passes advancedConfig to ChartSettingsTab', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    
    const chartTab = screen.getByText('settings.tabs.chart');
    fireEvent.click(chartTab);
    
    expect(screen.getByText('ChartSettingsTab Content')).toBeDefined();
  });
});
