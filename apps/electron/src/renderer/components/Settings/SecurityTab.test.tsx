import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockChangePassword = vi.fn().mockResolvedValue({ success: true });
const mockToggleTwoFactor = vi.fn().mockResolvedValue({ success: true });
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const mockRevokeSession = vi.fn().mockResolvedValue({ success: true });
const mockRevokeAllOthers = vi.fn().mockResolvedValue({ success: true });

let currentUserMock = {
  id: 'u1', email: 'user@example.com', name: 'Jane',
  emailVerified: true, twoFactorEnabled: false,
  hasAvatar: false, avatarColor: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

let sessionsList: Array<{
  id: string; createdAt: string; expiresAt: string;
  userAgent: string | null; ip: string | null; isCurrent: boolean;
}> = [
  { id: 's1', createdAt: '2026-04-20T10:00:00Z', expiresAt: '2026-05-20T10:00:00Z', userAgent: 'Chrome on macOS', ip: '1.2.3.4', isCurrent: true },
  { id: 's2', createdAt: '2026-04-15T10:00:00Z', expiresAt: '2026-05-15T10:00:00Z', userAgent: 'Safari on iOS', ip: '5.6.7.8', isCurrent: false },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; date?: string; defaultValue?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}`
        : opts?.date !== undefined ? `${key}:${opts.date}`
        : opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@renderer/hooks/useBackendAuth', () => ({
  useBackendAuth: () => ({
    currentUser: currentUserMock,
    changePassword: mockChangePassword,
    isChangingPassword: false,
    toggleTwoFactor: mockToggleTwoFactor,
    isTogglingTwoFactor: false,
  }),
}));

vi.mock('@renderer/hooks/useToast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    auth: {
      listSessions: { useQuery: () => ({ data: sessionsList, isLoading: false }) },
      revokeSession: { useMutation: () => ({ mutateAsync: mockRevokeSession, isPending: false }) },
      revokeAllOtherSessions: { useMutation: () => ({ mutateAsync: mockRevokeAllOthers, isPending: false }) },
    },
    useUtils: () => ({ auth: { listSessions: { invalidate: vi.fn() } } }),
  },
}));

import { SecurityTab } from './SecurityTab';

const renderTab = () => render(
  <ChakraProvider value={defaultSystem}>
    <SecurityTab />
  </ChakraProvider>
);

describe('SecurityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserMock = {
      id: 'u1', email: 'user@example.com', name: 'Jane',
      emailVerified: true, twoFactorEnabled: false,
      hasAvatar: false, avatarColor: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    sessionsList = [
      { id: 's1', createdAt: '2026-04-20T10:00:00Z', expiresAt: '2026-05-20T10:00:00Z', userAgent: 'Chrome on macOS', ip: '1.2.3.4', isCurrent: true },
      { id: 's2', createdAt: '2026-04-15T10:00:00Z', expiresAt: '2026-05-15T10:00:00Z', userAgent: 'Safari on iOS', ip: '5.6.7.8', isCurrent: false },
    ];
  });

  it('disables submit when current is empty', () => {
    renderTab();
    const btn = screen.getByTestId('security-change-password-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables submit when new password is too short', () => {
    renderTab();
    fireEvent.change(screen.getByTestId('security-current-password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByTestId('security-new-password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByTestId('security-confirm-password'), { target: { value: 'short' } });
    const btn = screen.getByTestId('security-change-password-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables submit when passwords do not match', () => {
    renderTab();
    fireEvent.change(screen.getByTestId('security-current-password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByTestId('security-new-password'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByTestId('security-confirm-password'), { target: { value: 'mismatch' } });
    const btn = screen.getByTestId('security-change-password-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables submit when new password violates policy (no symbol)', () => {
    renderTab();
    fireEvent.change(screen.getByTestId('security-current-password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByTestId('security-new-password'), { target: { value: 'NewPass1234' } });
    fireEvent.change(screen.getByTestId('security-confirm-password'), { target: { value: 'NewPass1234' } });
    const btn = screen.getByTestId('security-change-password-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls changePassword on valid submit', async () => {
    renderTab();
    fireEvent.change(screen.getByTestId('security-current-password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByTestId('security-new-password'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByTestId('security-confirm-password'), { target: { value: 'NewPass123!' } });
    fireEvent.click(screen.getByTestId('security-change-password-submit'));
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('oldpass1', 'NewPass123!'));
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('disables 2FA toggle when email is not verified', () => {
    currentUserMock = { ...currentUserMock, emailVerified: false };
    renderTab();
    const toggle = screen.getByTestId('security-2fa-toggle');
    expect(toggle.getAttribute('data-disabled')).not.toBeNull();
  });

  it('toggles 2FA when switch input is clicked (verified email)', async () => {
    renderTab();
    const toggle = screen.getByTestId('security-2fa-toggle');
    const input = toggle.querySelector('input');
    if (!input) throw new Error('hidden input not found');
    fireEvent.click(input);
    await waitFor(() => expect(mockToggleTwoFactor).toHaveBeenCalled());
  });

  it('shows current session badge', () => {
    renderTab();
    expect(screen.getByText('settings.security.sessions.current')).toBeDefined();
  });

  it('renders revoke button only for non-current sessions', () => {
    renderTab();
    expect(screen.queryByTestId('security-session-revoke-s1')).toBeNull();
    expect(screen.getByTestId('security-session-revoke-s2')).toBeDefined();
  });

  it('revokes individual session when revoke button is clicked', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('security-session-revoke-s2'));
    await waitFor(() => expect(mockRevokeSession).toHaveBeenCalledWith({ sessionId: 's2' }));
  });

  it('revokes all other sessions when global revoke clicked', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('security-revoke-all-others'));
    await waitFor(() => expect(mockRevokeAllOthers).toHaveBeenCalled());
  });

  it('hides revoke-all button when only the current session exists', () => {
    sessionsList = [sessionsList[0]!];
    renderTab();
    expect(screen.queryByTestId('security-revoke-all-others')).toBeNull();
  });
});
