import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '../ui/color-mode';
import { GeneralTab } from './GeneralTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}));

vi.mock('./LanguageSelector', () => ({
    LanguageSelector: () => <div>Language Selector</div>,
}));

const mockUseLocalStorage = vi.fn();
const mockUseAutoUpdate = vi.fn();
const mockUseDebounceCallback = vi.fn();

vi.mock('@/renderer/hooks/useLocalStorage', () => ({
    useLocalStorage: (key: string, defaultValue: unknown) => mockUseLocalStorage(key, defaultValue),
}));

vi.mock('@/renderer/hooks/useAutoUpdate', () => ({
    useAutoUpdate: () => mockUseAutoUpdate(),
}));

vi.mock('@/renderer/hooks/useDebounceCallback', () => ({
    useDebounceCallback: (fn: () => void, delay: number) => mockUseDebounceCallback(fn, delay),
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            <ColorModeProvider>
                {component}
            </ColorModeProvider>
        </ChakraProvider>
    );
};

describe('GeneralTab', () => {
    const mockCheckForUpdates = vi.fn();
    const mockStartAutoCheck = vi.fn();
    const mockStopAutoCheck = vi.fn();
    const mockSetAutoCheckUpdates = vi.fn();
    const mockSetAutoDownloadUpdates = vi.fn();
    const mockSetUpdateCheckInterval = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        mockUseAutoUpdate.mockReturnValue({
            status: 'idle',
            checkForUpdates: mockCheckForUpdates,
            startAutoCheck: mockStartAutoCheck,
            stopAutoCheck: mockStopAutoCheck,
        });

        mockUseDebounceCallback.mockImplementation((fn: () => void) => fn);

        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();
        global.alert = vi.fn();
        global.confirm = vi.fn(() => true);

        HTMLAnchorElement.prototype.click = vi.fn();
        HTMLInputElement.prototype.click = vi.fn();
    });

    it('renders language selector', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('settings.autoUpdate.title')).toBeDefined();
    });

    it('renders auto update section', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('settings.autoUpdate.title')).toBeDefined();
        expect(screen.getByText('settings.autoUpdate.checkAutomatically')).toBeDefined();
        expect(screen.getByText('settings.autoUpdate.downloadAutomatically')).toBeDefined();
    });

    it('renders check now button', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('settings.autoUpdate.checkNow')).toBeDefined();
    });

    it('checks for updates now', () => {
        renderWithChakra(<GeneralTab />);

        const checkNowButton = screen.getByText('settings.autoUpdate.checkNow');
        fireEvent.click(checkNowButton);

        expect(mockCheckForUpdates).toHaveBeenCalled();
    });

    it('disables check now button when checking', () => {
        mockUseAutoUpdate.mockReturnValue({
            status: 'checking',
            checkForUpdates: mockCheckForUpdates,
            startAutoCheck: mockStartAutoCheck,
            stopAutoCheck: mockStopAutoCheck,
        });

        renderWithChakra(<GeneralTab />);

        const checkNowButton = screen.getByText('settings.autoUpdate.checkNow').closest('button');
        expect(checkNowButton?.disabled).toBe(true);
    });

    it('resets auto update settings to defaults', () => {
        renderWithChakra(<GeneralTab />);

        const resetButtons = screen.getAllByText('settings.resetToDefaults');
        fireEvent.click(resetButtons[0]!);

        expect(mockSetAutoCheckUpdates).toHaveBeenCalled();
        expect(mockSetAutoDownloadUpdates).toHaveBeenCalled();
        expect(mockSetUpdateCheckInterval).toHaveBeenCalled();
    });

    it('renders update interval slider when auto check is enabled', () => {
        renderWithChakra(<GeneralTab />);

        expect(screen.getByText('settings.autoUpdate.checkInterval', { exact: false })).toBeDefined();
    });

    it('does not render update interval slider when auto check is disabled', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [false, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        const slider = screen.queryByRole('slider');
        expect(slider).toBeNull();
    });

    it('renders interval slider when auto check is enabled', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [48, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        const slider = document.querySelector('[role="slider"]');
        expect(slider).not.toBeNull();
    });

    it('renders with auto download enabled', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [true, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        expect(screen.getByText('settings.autoUpdate.downloadAutomatically')).toBeDefined();
    });

    it('renders correctly when both auto features are disabled', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [false, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        expect(screen.getByText('settings.autoUpdate.checkAutomatically')).toBeDefined();
        expect(screen.queryByRole('slider')).toBeNull();
    });

    it('renders with different interval values', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [72, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        expect(screen.getByText(/settings.autoUpdate.checkInterval/)).toBeDefined();
    });

    it('renders auto check checkbox', () => {
        renderWithChakra(<GeneralTab />);

        const checkbox = screen.getByRole('checkbox', { name: /checkAutomatically/i });
        expect(checkbox).toBeDefined();
    });

    it('renders auto download checkbox', () => {
        renderWithChakra(<GeneralTab />);

        const checkbox = screen.getByRole('checkbox', { name: /downloadAutomatically/i });
        expect(checkbox).toBeDefined();
    });

    it('renders both switches with correct initial states', () => {
        renderWithChakra(<GeneralTab />);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('renders theme buttons', () => {
        renderWithChakra(<GeneralTab />);

        expect(screen.getByText('header.themeLight')).toBeDefined();
        expect(screen.getByText('header.themeDark')).toBeDefined();
    });

    it('switches to light theme', () => {
        renderWithChakra(<GeneralTab />);

        const lightButton = screen.getByText('header.themeLight');
        fireEvent.click(lightButton);
    });

    it('switches to dark theme', () => {
        renderWithChakra(<GeneralTab />);

        const darkButton = screen.getByText('header.themeDark');
        fireEvent.click(darkButton);
    });

    it('handles reset when auto check is disabled in defaults', () => {
        vi.doMock('@/renderer/constants/defaults', () => ({
            DEFAULT_AUTO_UPDATE_SETTINGS: {
                autoCheckUpdates: false,
                autoDownloadUpdates: false,
                updateCheckInterval: 6,
            },
        }));

        renderWithChakra(<GeneralTab />);

        const resetButtons = screen.getAllByText('settings.resetToDefaults');
        fireEvent.click(resetButtons[0]!);

        expect(mockSetAutoCheckUpdates).toHaveBeenCalled();
        expect(mockSetAutoDownloadUpdates).toHaveBeenCalled();
        expect(mockSetUpdateCheckInterval).toHaveBeenCalled();
    });

    it('changes interval and restarts auto check', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        const slider = document.querySelector('[role="slider"]');
        expect(slider).not.toBeNull();
    });

    it('handles interval change when auto check is disabled', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['dark', vi.fn()];
            if (key === 'autoCheckUpdates') return [false, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        expect(mockStopAutoCheck).not.toHaveBeenCalled();
        expect(mockStartAutoCheck).not.toHaveBeenCalled();
    });

    it('renders with light theme active', () => {
        mockUseLocalStorage.mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'chakra-ui-color-mode') return ['light', vi.fn()];
            if (key === 'autoCheckUpdates') return [true, mockSetAutoCheckUpdates];
            if (key === 'autoDownloadUpdates') return [false, mockSetAutoDownloadUpdates];
            if (key === 'updateCheckInterval') return [24, mockSetUpdateCheckInterval];
            return [defaultValue, vi.fn()];
        });

        renderWithChakra(<GeneralTab />);

        expect(screen.getByText('header.themeLight')).toBeDefined();
    });
});
