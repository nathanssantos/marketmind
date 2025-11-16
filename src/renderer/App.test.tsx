import { ChakraProvider } from '@chakra-ui/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalActionsProvider } from './context/GlobalActionsContext';
import { system } from './theme';
import App from './App';

// Mock window.electron
global.window.electron = {
  onUpdateAvailable: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  onUpdateError: vi.fn(),
  onUpdateDownloadProgress: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
  skipVersion: vi.fn(),
  secureStorage: {
    setApiKey: vi.fn(),
    getApiKey: vi.fn(),
    deleteApiKey: vi.fn(),
    clear: vi.fn(),
  },
} as unknown as typeof window.electron;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
global.matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.mock('./hooks/useMarketData', () => ({
  useMarketData: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    fetchData: vi.fn(),
  })),
}));

vi.mock('./hooks/useNews', () => ({
  useNews: vi.fn(() => ({
    news: [],
    loading: false,
    error: null,
  })),
}));

vi.mock('./hooks/useAutoUpdate', () => ({
  useAutoUpdate: vi.fn(() => ({
    updateInfo: null,
    downloadProgress: null,
    error: null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
    skipVersion: vi.fn(),
  })),
}));

const mockActions = {
  openSettings: vi.fn(),
  toggleChatSidebar: vi.fn(),
  focusChatInput: vi.fn(),
  showKeyboardShortcuts: vi.fn(),
  openSymbolSelector: vi.fn(),
};

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(
      <ChakraProvider value={system}>
        <GlobalActionsProvider actions={mockActions}>
          <App />
        </GlobalActionsProvider>
      </ChakraProvider>
    );

    expect(container).toBeTruthy();
  });

  it('should render main layout', () => {
    const { container } = render(
      <ChakraProvider value={system}>
        <GlobalActionsProvider actions={mockActions}>
          <App />
        </GlobalActionsProvider>
      </ChakraProvider>
    );

    expect(container.querySelector('[class*="MainLayout"]')).toBeTruthy();
  });
});
