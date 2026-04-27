import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
let prefStore: Record<string, unknown> = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@renderer/store/preferencesStore', () => ({
  useUIPref: <T,>(key: string, defaultValue: T): [T, (v: T) => void] => {
    const value = (prefStore[key] ?? defaultValue) as T;
    return [value, (v: T) => { prefStore[key] = v; mockUpdate(key, v); }];
  },
}));

import { NotificationsTab } from './NotificationsTab';

describe('NotificationsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefStore = {};
  });

  const renderTab = () => render(
    <ChakraProvider value={defaultSystem}>
      <NotificationsTab />
    </ChakraProvider>
  );

  it('renders order toasts switch', () => {
    renderTab();
    expect(screen.getByTestId('notifications-order-toasts')).toBeDefined();
  });

  it('renders setup toasts switch', () => {
    renderTab();
    expect(screen.getByTestId('notifications-setup-toasts')).toBeDefined();
  });

  it('renders sound switch', () => {
    renderTab();
    expect(screen.getByTestId('notifications-sound-enabled')).toBeDefined();
  });

  it('shows the coming-soon notice', () => {
    renderTab();
    expect(screen.getByText('settings.notifications.comingSoon.title')).toBeDefined();
  });
});
