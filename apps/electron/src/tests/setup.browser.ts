import '@testing-library/jest-dom';
import { vi } from 'vitest';
import packageJson from '../../package.json';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

window.electron = {
  ipcRenderer: {
    on: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
  clipboard: {
    writeText: vi.fn(),
  },
  app: {
    getVersion: vi.fn(() => packageJson.version),
    getName: vi.fn(() => 'MarketMind'),
  },
  autoUpdater: {
    checkForUpdates: vi.fn(),
    onUpdateAvailable: vi.fn(),
    onUpdateDownloaded: vi.fn(),
    onDownloadProgress: vi.fn(),
    onError: vi.fn(),
    quitAndInstall: vi.fn(),
  },
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
} as any;
