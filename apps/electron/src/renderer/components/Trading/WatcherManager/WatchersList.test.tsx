import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WatchersList } from './WatchersList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseProps: Parameters<typeof WatchersList>[0] = {
  activeWatchers: [],
  persistedWatchers: 0,
  isLoading: false,
  isExpanded: true,
  onToggle: vi.fn(),
  onAddWatcher: vi.fn(),
  onStopWatcher: vi.fn(),
  onStopAll: vi.fn(),
  isStoppingWatcher: false,
  isStoppingAll: false,
  getProfileById: () => undefined,
  directionMode: 'BOTH',
  onDirectionModeChange: vi.fn(),
  isPendingConfig: false,
};

describe('WatchersList', () => {
  it('renders the empty-state when there are no active or persisted watchers', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <WatchersList {...baseProps} />
      </ChakraProvider>,
    );
    expect(screen.getByText('tradingProfiles.watchers.empty')).toBeDefined();
    expect(screen.getByText('tradingProfiles.watchers.addFirst')).toBeDefined();
  });

  it('does not render the empty-state when activeWatchers has entries', () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <WatchersList
          {...baseProps}
          activeWatchers={[
            {
              symbol: 'BTCUSDT',
              interval: '1h',
              marketType: 'FUTURES',
              profileId: 'profile-1',
            } as Parameters<typeof WatchersList>[0]['activeWatchers'][number],
          ]}
        />
      </ChakraProvider>,
    );
    expect(screen.queryByText('tradingProfiles.watchers.empty')).toBeNull();
  });
});
