import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useTradingProfilesMock } = vi.hoisted(() => ({
  useTradingProfilesMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@renderer/hooks/useTradingProfiles', () => ({
  useTradingProfiles: useTradingProfilesMock,
}));

vi.mock('./ImportProfileDialog', () => ({
  ImportProfileDialog: () => null,
}));

vi.mock('./ProfileEditorDialog', () => ({
  ProfileEditorDialog: () => null,
}));

import { TradingProfilesManager } from './TradingProfilesManager';

describe('TradingProfilesManager', () => {
  it('renders the empty-state when there are no profiles', () => {
    useTradingProfilesMock.mockReturnValue({
      profiles: [],
      isLoadingProfiles: false,
      deleteProfile: vi.fn(),
      duplicateProfile: vi.fn(),
      isDeletingProfile: false,
    });

    render(
      <ChakraProvider value={defaultSystem}>
        <TradingProfilesManager />
      </ChakraProvider>,
    );
    expect(screen.getByText('tradingProfiles.empty')).toBeDefined();
    expect(screen.getByText('tradingProfiles.createFirst')).toBeDefined();
  });

  it('shows loading state when isLoadingProfiles is true', () => {
    useTradingProfilesMock.mockReturnValue({
      profiles: [],
      isLoadingProfiles: true,
      deleteProfile: vi.fn(),
      duplicateProfile: vi.fn(),
      isDeletingProfile: false,
    });

    const { container } = render(
      <ChakraProvider value={defaultSystem}>
        <TradingProfilesManager />
      </ChakraProvider>,
    );
    expect(container.querySelector('.chakra-spinner')).toBeDefined();
  });
});
