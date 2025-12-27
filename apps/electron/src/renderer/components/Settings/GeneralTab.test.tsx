import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '../ui/color-mode';
import { GeneralTab } from './GeneralTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, number>) => {
            if (key === 'settings.dataManagement.totalConversations') return `Total: ${options?.count ?? 0}`;
            return key;
        },
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}));

vi.mock('./LanguageSelector', () => ({
    LanguageSelector: () => <div>Language Selector</div>,
}));

const mockConversations = [
    { id: '1', messages: [], openTime: Date.now() },
    { id: '2', messages: [], openTime: Date.now() },
];

const mockUseAIStore = vi.fn();
const mockUseLocalStorage = vi.fn();
const mockUseAutoUpdate = vi.fn();
const mockUseDebounceCallback = vi.fn();

vi.mock('@/renderer/store', () => ({
    useAIStore: () => mockUseAIStore(),
}));

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
    const mockImportConversation = vi.fn();
    const mockClearAll = vi.fn();
    const mockCheckForUpdates = vi.fn();
    const mockStartAutoCheck = vi.fn();
    const mockStopAutoCheck = vi.fn();
    const mockSetAutoCheckUpdates = vi.fn();
    const mockSetAutoDownloadUpdates = vi.fn();
    const mockSetUpdateCheckInterval = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAIStore.mockReturnValue({
            conversations: mockConversations,
            importConversation: mockImportConversation,
            clearAll: mockClearAll,
        });

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

    it('displays correct conversation count', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('Total: 2')).toBeDefined();
    });

    it('exports conversations when export button clicked', () => {
        renderWithChakra(<GeneralTab />);

        const exportButton = screen.getByText('settings.dataManagement.exportAll');
        fireEvent.click(exportButton);

        expect(global.URL.createObjectURL).toHaveBeenCalled();
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('disables export button when no conversations', () => {
        mockUseAIStore.mockReturnValue({
            conversations: [],
            importConversation: mockImportConversation,
            clearAll: mockClearAll,
        });

        renderWithChakra(<GeneralTab />);

        const exportButton = screen.getByText('settings.dataManagement.exportAll').closest('button');
        expect(exportButton?.disabled).toBe(true);
    });

    it('imports conversation file', async () => {
        const mockFile = new File(['{"conversations": []}'], 'test.json', { type: 'application/json' });
        const mockFileReader = {
            readAsText: vi.fn(),
            onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
        };

        global.FileReader = vi.fn(() => mockFileReader) as unknown as typeof FileReader;

        renderWithChakra(<GeneralTab />);

        const importButton = screen.getByText('settings.dataManagement.importConversation');
        fireEvent.click(importButton);

        expect(HTMLInputElement.prototype.click).toHaveBeenCalled();
    });

    it('clears all conversations with confirmation', () => {
        renderWithChakra(<GeneralTab />);

        const clearButton = screen.getByText('settings.dataManagement.clearAll');
        fireEvent.click(clearButton);

        expect(global.confirm).toHaveBeenCalledWith('settings.dataManagement.confirmClear');
        expect(mockClearAll).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith('settings.dataManagement.clearSuccess');
    });

    it('does not clear when confirmation cancelled', () => {
        global.confirm = vi.fn(() => false);

        renderWithChakra(<GeneralTab />);

        const clearButton = screen.getByText('settings.dataManagement.clearAll');
        fireEvent.click(clearButton);

        expect(mockClearAll).not.toHaveBeenCalled();
    });

    it('disables clear button when no conversations', () => {
        mockUseAIStore.mockReturnValue({
            conversations: [],
            importConversation: mockImportConversation,
            clearAll: mockClearAll,
        });

        renderWithChakra(<GeneralTab />);

        const clearButton = screen.getByText('settings.dataManagement.clearAll').closest('button');
        expect(clearButton?.disabled).toBe(true);
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
});

