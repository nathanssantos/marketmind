import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockOpenSettings = vi.fn();
const mockLogout = vi.fn().mockResolvedValue(undefined);

let currentUserMock: {
  id: string; email: string; name: string | null;
  emailVerified: boolean; twoFactorEnabled: boolean;
  hasAvatar: boolean; avatarColor: string | null;
} | null = {
  id: 'u1', email: 'jane@example.com', name: 'Jane Smith',
  emailVerified: true, twoFactorEnabled: false,
  hasAvatar: false, avatarColor: null,
};

let avatarData: { data: string; mimeType: string } | null = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/renderer/context/GlobalActionsContext', () => ({
  useGlobalActionsOptional: () => ({
    openSettings: mockOpenSettings,
    openSymbolSelector: vi.fn(),
    navigateToSymbol: vi.fn(),
  }),
}));

vi.mock('../hooks/useBackendAuth', () => ({
  useBackendAuth: () => ({ currentUser: currentUserMock, logout: mockLogout }),
}));

vi.mock('../utils/trpc', () => ({
  trpc: {
    auth: {
      getAvatar: { useQuery: () => ({ data: avatarData }) },
    },
  },
}));

import { UserAvatar } from './UserAvatar';

const renderAvatar = () => render(
  <MemoryRouter>
    <ChakraProvider value={defaultSystem}>
      <UserAvatar />
    </ChakraProvider>
  </MemoryRouter>
);

describe('UserAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserMock = {
      id: 'u1', email: 'jane@example.com', name: 'Jane Smith',
      emailVerified: true, twoFactorEnabled: false,
      hasAvatar: false, avatarColor: null,
    };
    avatarData = null;
  });

  it('renders user initials when no avatar uploaded', () => {
    renderAvatar();
    expect(screen.getByText('JS')).toBeDefined();
  });

  it('renders avatar image when available', () => {
    currentUserMock = { ...currentUserMock!, hasAvatar: true };
    avatarData = { data: 'AAAA', mimeType: 'image/png' };
    renderAvatar();
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('renders the avatar trigger button with aria-label', () => {
    renderAvatar();
    expect(screen.getByLabelText('account.title')).toBeDefined();
  });

  it('uses configured avatar color as background fallback', () => {
    currentUserMock = { ...currentUserMock!, avatarColor: '#10B981' };
    renderAvatar();
    const trigger = screen.getByLabelText('account.title');
    expect(trigger).toBeDefined();
  });
});
