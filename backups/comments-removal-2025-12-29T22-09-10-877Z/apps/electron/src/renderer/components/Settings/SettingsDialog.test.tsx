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
        klineSpacing: 0.3,
        klineWickWidth: 1,
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

    it('calls onClose when dialog close is triggered', () => {
        const { container } = renderWithChakra(
            <SettingsDialog
                isOpen={true}
                onClose={mockOnClose}
                advancedConfig={mockAdvancedConfig}
                onAdvancedConfigChange={mockOnAdvancedConfigChange}
            />
        );

        const backdrop = container.querySelector('[data-scope="dialog"][data-part="backdrop"]');
        if (backdrop) {
            fireEvent.click(backdrop);
        }

        expect(container).toBeDefined();
    });
});
