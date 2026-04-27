import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetPref = vi.fn();
const mockCheckForUpdates = vi.fn().mockResolvedValue(undefined);
const mockDownloadUpdate = vi.fn().mockResolvedValue(undefined);
const mockStartAutoCheck = vi.fn().mockResolvedValue(undefined);
const mockStopAutoCheck = vi.fn().mockResolvedValue(undefined);

let prefStore: Record<string, unknown> = {};
let updateStatus: 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' = 'not-available';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { hours?: number; defaultValue?: string }) =>
      opts?.hours !== undefined ? `${key}:${opts.hours}` : opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/renderer/store/preferencesStore', () => ({
  useUIPref: <T,>(key: string, defaultValue: T): [T, (v: T) => void] => {
    const value = (prefStore[key] ?? defaultValue) as T;
    return [value, (v: T) => { prefStore[key] = v; mockSetPref(key, v); }];
  },
}));

vi.mock('@/renderer/hooks/useAutoUpdate', () => ({
  useAutoUpdate: () => ({
    status: updateStatus,
    updateInfo: null,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    startAutoCheck: mockStartAutoCheck,
    stopAutoCheck: mockStopAutoCheck,
  }),
}));

vi.mock('@/renderer/hooks/useDebounceCallback', () => ({
  useDebounceCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

import { UpdatesTab } from './UpdatesTab';

const renderTab = () => render(
  <ChakraProvider value={defaultSystem}>
    <UpdatesTab />
  </ChakraProvider>
);

describe('UpdatesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefStore = {};
    updateStatus = 'not-available';
  });

  it('triggers check-for-updates when button clicked', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('updates-check-now'));
    await waitFor(() => expect(mockCheckForUpdates).toHaveBeenCalled());
  });

  it('renders auto-check switch', () => {
    renderTab();
    expect(screen.getByTestId('updates-auto-check')).toBeDefined();
  });

  it('renders auto-download switch', () => {
    renderTab();
    expect(screen.getByTestId('updates-auto-download')).toBeDefined();
  });

  it('shows up-to-date badge when status is not-available', () => {
    updateStatus = 'not-available';
    renderTab();
    expect(screen.getByText('about.update.upToDate')).toBeDefined();
  });
});
