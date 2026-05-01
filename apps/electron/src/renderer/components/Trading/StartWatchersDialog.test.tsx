import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startWatchersBulkMock = vi.fn().mockResolvedValue(undefined);
const updateConfigMutationMock = { mutate: vi.fn(), isPending: false };
const openSettingsMock = vi.fn();

let activeWalletMock: { id: string } | null = { id: 'w1' };
let configMock: { directionMode: string; useTrendFilter: boolean; useFundingFilter?: boolean; useBtcCorrelationFilter?: boolean } | null = {
  directionMode: 'auto',
  useTrendFilter: true,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; defaultValue?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : opts?.defaultValue ?? key,
  }),
}));

vi.mock('@renderer/hooks/useBackendAutoTrading', () => ({
  useBackendAutoTrading: () => ({
    startWatchersBulk: startWatchersBulkMock,
    isStartingWatchersBulk: false,
  }),
  useCapitalLimits: () => ({
    formatCapitalTooltip: () => 'capital info',
  }),
  useFilteredSymbolsForQuickStart: () => ({
    filteredSymbols: ['BTCUSDT', 'ETHUSDT'],
    maxAffordableWatchers: 20,
    isLoadingFiltered: false,
    skippedTrend: [],
  }),
}));

vi.mock('@renderer/hooks/useActiveWallet', () => ({
  useActiveWallet: () => ({ activeWallet: activeWalletMock }),
}));

vi.mock('@renderer/hooks/useDebounce', () => ({
  useDebounce: <T,>(v: T) => v,
}));

vi.mock('@renderer/utils/trpc', () => ({
  trpc: {
    useUtils: () => ({ autoTrading: { getConfig: { invalidate: vi.fn() } } }),
    autoTrading: {
      getConfig: { useQuery: () => ({ data: configMock }) },
      updateConfig: { useMutation: () => updateConfigMutationMock },
      getBtcTrendStatus: { useQuery: () => ({ data: null }) },
      getBatchFundingRates: { useQuery: () => ({ data: [] }) },
    },
  },
}));

vi.mock('@renderer/context/GlobalActionsContext', () => ({
  useGlobalActionsOptional: () => ({ openSettings: openSettingsMock }),
}));

vi.mock('@renderer/components/Chart/TimeframeSelector', () => ({
  TimeframeSelector: ({ selectedTimeframe }: { selectedTimeframe: string }) => (
    <div data-testid="tf-selector">{selectedTimeframe}</div>
  ),
}));

vi.mock('./DirectionBadge', () => ({
  DirectionBadge: () => <span data-testid="direction-badge" />,
}));

import { StartWatchersDialog } from './StartWatchersDialog';

const renderModal = (overrides: { isOpen?: boolean } = {}) => {
  const onClose = vi.fn();
  return {
    ...render(
      <ChakraProvider value={defaultSystem}>
        <StartWatchersDialog isOpen={overrides.isOpen ?? true} onClose={onClose} />
      </ChakraProvider>
    ),
    onClose,
  };
};

describe('StartWatchersDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeWalletMock = { id: 'w1' };
    configMock = { directionMode: 'auto', useTrendFilter: true };
  });

  it('does not render when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('marketSidebar.watchers.startWatchers')).toBeNull();
  });

  it('renders the title when open', () => {
    renderModal();
    expect(screen.getByText('marketSidebar.watchers.startWatchers')).toBeDefined();
  });

  it('shows no-wallet Callout when activeWallet is null', () => {
    activeWalletMock = null;
    renderModal();
    expect(screen.getByText('trading.portfolio.noWallet')).toBeDefined();
  });

  it('renders Spot/Futures market type toggle', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Spot' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Futures' })).toBeDefined();
  });

  it('renders direction toggles (long/auto/short)', () => {
    renderModal();
    expect(screen.getByText('settings.algorithmicAutoTrading.directionMode.shortOnly')).toBeDefined();
    expect(screen.getByText('settings.algorithmicAutoTrading.directionMode.auto')).toBeDefined();
    expect(screen.getByText('settings.algorithmicAutoTrading.directionMode.longOnly')).toBeDefined();
  });

  it('clicking Long Only fires updateConfig with direction long_only', () => {
    renderModal();
    fireEvent.click(screen.getByText('settings.algorithmicAutoTrading.directionMode.longOnly'));
    expect(updateConfigMutationMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ directionMode: 'long_only' })
    );
  });

  it('clicking Short Only fires updateConfig with direction short_only', () => {
    renderModal();
    fireEvent.click(screen.getByText('settings.algorithmicAutoTrading.directionMode.shortOnly'));
    expect(updateConfigMutationMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ directionMode: 'short_only' })
    );
  });

  it('clicking Settings opens settings dialog and closes modal', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /header.settings/ }));
    expect(openSettingsMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Cancel closes the modal', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the info Callout footer', () => {
    renderModal();
    expect(screen.getByText('tradingProfiles.dynamicSelection.infoText')).toBeDefined();
  });
});
