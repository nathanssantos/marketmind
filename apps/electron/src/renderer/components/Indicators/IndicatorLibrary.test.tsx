import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useUserIndicatorsMock } = vi.hoisted(() => ({
  useUserIndicatorsMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@renderer/hooks', () => ({
  useUserIndicators: useUserIndicatorsMock,
}));

import { IndicatorLibrary } from './IndicatorLibrary';

const renderLibrary = () =>
  render(
    <ChakraProvider value={defaultSystem}>
      <IndicatorLibrary />
    </ChakraProvider>,
  );

describe('IndicatorLibrary', () => {
  it('renders the empty-state when there are no user indicators', () => {
    useUserIndicatorsMock.mockReturnValue({
      indicators: [],
      isLoading: false,
      create: { mutateAsync: vi.fn() },
      update: { mutateAsync: vi.fn() },
      remove: { mutateAsync: vi.fn() },
      duplicate: { mutateAsync: vi.fn() },
      reset: { mutateAsync: vi.fn() },
    });

    renderLibrary();
    expect(screen.getByText('settings.indicators.emptyTitle')).toBeDefined();
    expect(screen.getByText('settings.indicators.emptyDescription')).toBeDefined();
  });
});
