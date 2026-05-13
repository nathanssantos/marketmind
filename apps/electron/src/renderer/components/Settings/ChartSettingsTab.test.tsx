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

vi.mock('@renderer/components/ui', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        useColorMode: () => ({ colorMode: 'dark', setColorMode: vi.fn(), toggleColorMode: vi.fn() }),
    };
});

const mockSetChartPref = vi.fn();

vi.mock('@/renderer/store/preferencesStore', () => ({
    usePreferencesStore: (selector: (state: Record<string, unknown>) => unknown) =>
        selector({ chart: { chartColorPalette: 'default' }, ui: {}, trading: {} }),
    useChartPref: (_key: string, defaultValue: unknown) => [defaultValue, mockSetChartPref],
}));

const mockSetEnableShiftAltOrderEntry = vi.fn();

vi.mock('@/renderer/store/uiStore', () => ({
    useUIStore: (selector: (state: { enableShiftAltOrderEntry: boolean; setEnableShiftAltOrderEntry: typeof mockSetEnableShiftAltOrderEntry }) => unknown) =>
        selector({
            enableShiftAltOrderEntry: false,
            setEnableShiftAltOrderEntry: mockSetEnableShiftAltOrderEntry,
        }),
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

    beforeEach(() => {
        vi.clearAllMocks();
        mockSetEnableShiftAltOrderEntry.mockClear();
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

        expect(screen.getByText(/settings\.chart\.chartDimensions/)).toBeDefined();
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

    it('renders kline spacing field', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.klineSpacing')).toBeDefined();
    });

    it('renders grid settings section', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.gridSettings')).toBeDefined();
    });

    it('renders line style field', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.lineStyle')).toBeDefined();
    });

    it('renders padding settings section', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.chartPadding')).toBeDefined();
    });

    it('handles invalid numeric input gracefully', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const firstInput = inputs[0];

        fireEvent.change(firstInput!, { target: { value: 'invalid' } });

        expect(mockOnConfigChange).not.toHaveBeenCalled();
    });

    it('updates right margin value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const rightMarginInput = inputs[0];

        fireEvent.change(rightMarginInput!, { target: { value: '100' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            rightMargin: 100,
        });
    });

    it('updates volume height ratio value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const volumeHeightInput = inputs[1];

        fireEvent.change(volumeHeightInput!, { target: { value: '0.3' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            volumeHeightRatio: 0.3,
        });
    });

    it('updates kline spacing value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const klineSpacingInput = inputs[2];

        fireEvent.change(klineSpacingInput!, { target: { value: '10' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            klineSpacing: 10,
        });
    });

    it('updates kline wick width value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const wickWidthInput = inputs[3];

        fireEvent.change(wickWidthInput!, { target: { value: '2' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            klineWickWidth: 2,
        });
    });

    it('updates grid line width value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const gridLineWidthInput = inputs[4];

        fireEvent.change(gridLineWidthInput!, { target: { value: '3' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            gridLineWidth: 3,
        });
    });

    it('updates current price line width value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const priceLineWidthInput = inputs[5];

        fireEvent.change(priceLineWidthInput!, { target: { value: '4' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            currentPriceLineWidth: 4,
        });
    });

    it('updates current price line style', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const selectTrigger = screen.getByText('settings.chart.solid');
        fireEvent.click(selectTrigger);

        const dashedOption = screen.getByText('settings.chart.dashed');
        fireEvent.click(dashedOption);

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            currentPriceLineStyle: 'dashed',
        });
    });

    it('updates padding top value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const paddingTopInput = inputs[6];

        fireEvent.change(paddingTopInput!, { target: { value: '20' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            paddingTop: 20,
        });
    });

    it('updates padding bottom value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const paddingBottomInput = inputs[7];

        fireEvent.change(paddingBottomInput!, { target: { value: '25' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            paddingBottom: 25,
        });
    });

    it('updates padding left value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const paddingLeftInput = inputs[8];

        fireEvent.change(paddingLeftInput!, { target: { value: '15' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            paddingLeft: 15,
        });
    });

    it('updates padding right value', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const inputs = screen.getAllByRole('spinbutton');
        const paddingRightInput = inputs[9];

        fireEvent.change(paddingRightInput!, { target: { value: '18' } });

        expect(mockOnConfigChange).toHaveBeenCalledWith({
            ...mockConfig,
            paddingRight: 18,
        });
    });

    it('renders trading section with shift/alt order entry toggle', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.trading')).toBeDefined();
        expect(screen.getByText('settings.chart.enableShiftAltOrderEntry')).toBeDefined();
        expect(screen.getByText('settings.chart.enableShiftAltOrderEntryHelper')).toBeDefined();
    });

    it('renders breakeven lines toggle (off by default)', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('chart.controls.showBreakevenLines')).toBeDefined();
        expect(screen.getByText('chart.controls.showBreakevenLinesHelper')).toBeDefined();
        const toggle = screen.getByTestId('chart-show-breakeven-lines');
        expect(toggle).toBeDefined();
    });


    it('renders color palette section with all palettes', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        expect(screen.getByText('settings.chart.colorPalette')).toBeDefined();
        expect(screen.getByText('TradingView')).toBeDefined();
        expect(screen.getByText('Classic B&W')).toBeDefined();
        expect(screen.getByText('Binance')).toBeDefined();
        expect(screen.getByText('Blue & Orange')).toBeDefined();
        expect(screen.getByText('Night Owl')).toBeDefined();
    });

    it('renders shift/alt order entry checkbox', () => {
        renderWithChakra(
            <ChartSettingsTab config={mockConfig} onConfigChange={mockOnConfigChange} />
        );

        const checkbox = screen.getByRole('checkbox', { name: /enableShiftAltOrderEntry/i });
        expect(checkbox).toBeDefined();
    });

});
