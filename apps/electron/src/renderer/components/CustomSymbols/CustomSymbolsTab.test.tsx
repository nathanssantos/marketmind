import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useBackendCustomSymbolsMock } = vi.hoisted(() => ({
  useBackendCustomSymbolsMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/useBackendCustomSymbols', () => ({
  useBackendCustomSymbols: useBackendCustomSymbolsMock,
}));

vi.mock('../../utils/toaster', () => ({
  toaster: { create: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { CustomSymbolsTab } from './CustomSymbolsTab';

describe('CustomSymbolsTab', () => {
  it('renders the empty-state when there are no custom symbols', () => {
    useBackendCustomSymbolsMock.mockReturnValue({
      customSymbols: { data: [] },
      createCustomSymbol: { mutateAsync: vi.fn() },
      deleteCustomSymbol: { mutateAsync: vi.fn() },
      rebalanceCustomSymbol: { mutateAsync: vi.fn() },
    });

    render(
      <ChakraProvider value={defaultSystem}>
        <CustomSymbolsTab />
      </ChakraProvider>,
    );
    expect(screen.getByText('common.noResults')).toBeDefined();
  });
});
