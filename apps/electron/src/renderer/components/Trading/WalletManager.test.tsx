import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useBackendWalletMock, useBackendAnalyticsMock, useUIStoreMock } = vi.hoisted(() => ({
  useBackendWalletMock: vi.fn(),
  useBackendAnalyticsMock: vi.fn(),
  useUIStoreMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@renderer/hooks/useBackendWallet', () => ({
  useBackendWallet: useBackendWalletMock,
}));

vi.mock('@renderer/hooks/useBackendAnalytics', () => ({
  useBackendAnalytics: useBackendAnalyticsMock,
}));

vi.mock('../../store/uiStore', () => ({
  useUIStore: useUIStoreMock,
}));

vi.mock('./CreateWalletDialog', () => ({
  CreateWalletDialog: () => null,
}));

vi.mock('@renderer/components/BrlValue', () => ({
  BrlValue: () => null,
}));

import { WalletManager } from './WalletManager';

describe('WalletManager', () => {
  it('renders the empty-state when there are no wallets', () => {
    useBackendWalletMock.mockReturnValue({
      wallets: [],
      isLoading: false,
      deleteWallet: vi.fn(),
      createPaperWallet: vi.fn(),
      createWallet: vi.fn(),
      syncBalance: vi.fn(),
      syncTransfers: vi.fn(),
      isDeleting: false,
      isCreatingPaper: false,
      isCreating: false,
      isSyncing: false,
    });
    useBackendAnalyticsMock.mockReturnValue({ performance: undefined });
    useUIStoreMock.mockReturnValue(undefined);

    render(
      <ChakraProvider value={defaultSystem}>
        <WalletManager />
      </ChakraProvider>,
    );
    expect(screen.getByText('trading.wallets.emptyReal')).toBeDefined();
  });

  it('shows loading state when isLoading is true', () => {
    useBackendWalletMock.mockReturnValue({
      wallets: [],
      isLoading: true,
      deleteWallet: vi.fn(),
      createPaperWallet: vi.fn(),
      createWallet: vi.fn(),
      syncBalance: vi.fn(),
      syncTransfers: vi.fn(),
      isDeleting: false,
      isCreatingPaper: false,
      isCreating: false,
      isSyncing: false,
    });

    render(
      <ChakraProvider value={defaultSystem}>
        <WalletManager />
      </ChakraProvider>,
    );
    expect(screen.getByText('common.loading')).toBeDefined();
  });
});
