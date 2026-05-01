import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog } from './SettingsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('./AccountTab', () => ({ AccountTab: () => <div>AccountTab Content</div> }));
vi.mock('./SecurityTab', () => ({ SecurityTab: () => <div>SecurityTab Content</div> }));
vi.mock('./NotificationsTab', () => ({ NotificationsTab: () => <div>NotificationsTab Content</div> }));
vi.mock('./GeneralTab', () => ({ GeneralTab: () => <div>GeneralTab Content</div> }));
vi.mock('./ChartSettingsTab', () => ({ ChartSettingsTab: () => <div>ChartSettingsTab Content</div> }));
vi.mock('./AboutTab', () => ({ AboutTab: () => <div>AboutTab Content</div> }));
vi.mock('./DataTab', () => ({ DataTab: () => <div>DataTab Content</div> }));
vi.mock('./IndicatorsTab', () => ({ IndicatorsTab: () => <div>IndicatorsTab Content</div> }));
vi.mock('./AutoTradingTab', () => ({ AutoTradingTab: () => <div>AutoTradingTab Content</div> }));
vi.mock('../CustomSymbols', () => ({ CustomSymbolsTab: () => <div>CustomSymbolsTab Content</div> }));

const renderWithChakra = (component: React.ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{component}</ChakraProvider>);

const mockAdvancedConfig = {
  rightMargin: 72,
  volumeHeightRatio: 0.2,
  klineSpacing: 0.3,
  klineWickWidth: 1,
  gridLineWidth: 1,
  currentPriceLineWidth: 2,
  currentPriceLineStyle: 'solid' as const,
  paddingTop: 10,
  paddingBottom: 10,
  paddingLeft: 0,
  paddingRight: 0,
};

describe('SettingsDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnAdvancedConfigChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title when open', () => {
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

  it('shows the section group labels in the rail', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    expect(screen.getByText('settings.section.account')).toBeDefined();
    expect(screen.getByText('settings.section.appearance')).toBeDefined();
    expect(screen.getByText('settings.section.trading')).toBeDefined();
    expect(screen.getByText('settings.section.system')).toBeDefined();
  });

  it('renders Account tab content by default', async () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    expect(await screen.findByText('AccountTab Content')).toBeDefined();
  });

  it('opens on the requested initialTab', async () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        initialTab="security"
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    expect(await screen.findByText('SecurityTab Content')).toBeDefined();
  });

  it('switches to a different tab via initialTab prop', async () => {
    const { rerender } = renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        initialTab="account"
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    expect(await screen.findByText('AccountTab Content')).toBeDefined();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <SettingsDialog
          isOpen={true}
          onClose={mockOnClose}
          initialTab="chart"
          advancedConfig={mockAdvancedConfig}
          onAdvancedConfigChange={mockOnAdvancedConfigChange}
        />
      </ChakraProvider>
    );
    expect(await screen.findByText('ChartSettingsTab Content')).toBeDefined();
  });

  it('renders an icon-prefixed trigger for each tab', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    const tabsToCheck = [
      'account', 'security', 'notifications',
      'general', 'chart',
      'autoTrading', 'indicators', 'customSymbols',
      'data', 'about',
    ];
    for (const t of tabsToCheck) {
      expect(screen.getByTestId(`settings-tab-${t}`)).toBeDefined();
    }
  });

  it('renders the rail container', () => {
    renderWithChakra(
      <SettingsDialog
        isOpen={true}
        onClose={mockOnClose}
        advancedConfig={mockAdvancedConfig}
        onAdvancedConfigChange={mockOnAdvancedConfigChange}
      />
    );
    expect(screen.getByTestId('settings-rail')).toBeDefined();
  });
});
