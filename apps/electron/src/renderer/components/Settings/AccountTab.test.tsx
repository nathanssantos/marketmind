import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateProfile = vi.fn().mockResolvedValue({ success: true });
const mockUploadAvatar = vi.fn().mockResolvedValue({ success: true });
const mockDeleteAvatar = vi.fn().mockResolvedValue({ success: true });
const mockResendVerification = vi.fn().mockResolvedValue({ success: true });
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

let currentUserMock: {
  id: string; email: string; name: string | null;
  emailVerified: boolean; twoFactorEnabled: boolean;
  hasAvatar: boolean; avatarColor: string | null;
  createdAt: string;
} | null = {
  id: 'u1', email: 'user@example.com', name: 'Jane Smith',
  emailVerified: false, twoFactorEnabled: false,
  hasAvatar: false, avatarColor: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; maxKb?: number; defaultValue?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}`
        : opts?.maxKb !== undefined ? `${key}:${opts.maxKb}`
        : opts?.defaultValue ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@renderer/hooks/useBackendAuth', () => ({
  useBackendAuth: () => ({
    currentUser: currentUserMock,
    updateProfile: mockUpdateProfile,
    isUpdatingProfile: false,
    uploadAvatar: mockUploadAvatar,
    isUploadingAvatar: false,
    deleteAvatar: mockDeleteAvatar,
    isDeletingAvatar: false,
    resendVerificationEmail: mockResendVerification,
    isResendingVerification: false,
  }),
}));

vi.mock('@renderer/hooks/useToast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
    warning: vi.fn(),
  }),
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    auth: {
      getAvatar: {
        useQuery: () => ({ data: null, refetch: vi.fn().mockResolvedValue({}) }),
      },
    },
  },
}));

import { AccountTab } from './AccountTab';

const renderTab = () => render(
  <ChakraProvider value={defaultSystem}>
    <AccountTab />
  </ChakraProvider>
);

describe('AccountTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserMock = {
      id: 'u1', email: 'user@example.com', name: 'Jane Smith',
      emailVerified: false, twoFactorEnabled: false,
      hasAvatar: false, avatarColor: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  });

  it('renders the user name in the input', () => {
    renderTab();
    const input = screen.getByTestId('account-name-input') as HTMLInputElement;
    expect(input.value).toBe('Jane Smith');
  });

  it('saves the display name when Save is clicked', async () => {
    renderTab();
    const input = screen.getByTestId('account-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByTestId('account-name-save-button'));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'New Name' });
    });
  });

  it('shows the resend verification button when email is not verified', () => {
    renderTab();
    expect(screen.getByTestId('account-resend-verification-button')).toBeDefined();
  });

  it('hides the resend verification button when email is verified', () => {
    currentUserMock = { ...currentUserMock!, emailVerified: true };
    renderTab();
    expect(screen.queryByTestId('account-resend-verification-button')).toBeNull();
  });

  it('calls resendVerificationEmail when Resend is clicked', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('account-resend-verification-button'));
    await waitFor(() => expect(mockResendVerification).toHaveBeenCalled());
  });

  it('uploads avatar when a valid file is selected', async () => {
    renderTab();
    const fileInput = screen.getByTestId('account-avatar-file-input') as HTMLInputElement;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => expect(mockUploadAvatar).toHaveBeenCalled());
    expect(mockUploadAvatar.mock.calls[0]![1]).toBe('image/png');
  });

  it('rejects unsupported file types and toasts error', async () => {
    renderTab();
    const fileInput = screen.getByTestId('account-avatar-file-input') as HTMLInputElement;
    const file = new File(['x'], 'a.svg', { type: 'image/svg+xml' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it('shows the delete avatar button when user has an avatar', () => {
    currentUserMock = { ...currentUserMock!, hasAvatar: true };
    renderTab();
    expect(screen.getByTestId('account-avatar-delete-button')).toBeDefined();
  });

  it('hides the color picker when user has an avatar (image takes priority)', () => {
    currentUserMock = { ...currentUserMock!, hasAvatar: true };
    renderTab();
    expect(screen.queryByTestId('avatar-color-#3B82F6')).toBeNull();
  });

  it('saves avatar color when a color swatch is clicked', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('avatar-color-#10B981'));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ avatarColor: '#10B981' });
    });
  });
});
