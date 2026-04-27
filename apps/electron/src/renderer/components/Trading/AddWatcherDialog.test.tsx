import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingProfile } from '@marketmind/types';

const startWatcherMock = vi.fn().mockResolvedValue(undefined);
const startWatchersBulkMock = vi.fn().mockResolvedValue(undefined);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; defaultValue?: string }) =>
      opts?.count !== undefined ? `${key}:${opts.count}` : opts?.defaultValue ?? key,
  }),
}));

vi.mock('@renderer/hooks/useBackendAutoTrading', () => ({
  useBackendAutoTrading: () => ({
    startWatcher: startWatcherMock,
    startWatchersBulk: startWatchersBulkMock,
    isStartingWatcher: false,
    isStartingWatchersBulk: false,
  }),
}));

vi.mock('../SymbolSelector', () => ({
  SymbolSelector: ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
    <input
      data-testid="symbol-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../Chart/TimeframeSelector', () => ({
  TimeframeSelector: ({ selectedTimeframe }: { selectedTimeframe: string }) => (
    <div data-testid="tf-selector">{selectedTimeframe}</div>
  ),
}));

vi.mock('./BulkSymbolSelector', () => ({
  BulkSymbolSelector: ({ selectedSymbols }: { selectedSymbols: string[] }) => (
    <div data-testid="bulk-selector">{selectedSymbols.length} selected</div>
  ),
}));

import { AddWatcherDialog } from './AddWatcherDialog';

const PROFILES: TradingProfile[] = [
  {
    id: 'p1', name: 'Default', isDefault: true,
    enabledSetupTypes: [], userId: 'u1',
    createdAt: new Date(), updatedAt: new Date(),
  } as unknown as TradingProfile,
];

const renderDialog = (overrides: Partial<Parameters<typeof AddWatcherDialog>[0]> = {}) => {
  const onClose = vi.fn();
  return {
    ...render(
      <ChakraProvider value={defaultSystem}>
        <AddWatcherDialog
          isOpen
          onClose={onClose}
          walletId="w1"
          profiles={PROFILES}
          {...overrides}
        />
      </ChakraProvider>
    ),
    onClose,
  };
};

describe('AddWatcherDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not render when isOpen=false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('tradingProfiles.watchers.addTitle')).toBeNull();
  });

  it('renders the add-watcher title', () => {
    renderDialog();
    expect(screen.getByText('tradingProfiles.watchers.addTitle')).toBeDefined();
  });

  it('starts in single mode showing the single-symbol selector', () => {
    renderDialog();
    expect(screen.getByTestId('symbol-input')).toBeDefined();
    expect(screen.queryByTestId('bulk-selector')).toBeNull();
  });

  it('toggles to bulk mode when Bulk button clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByText('tradingProfiles.watchers.bulkMode'));
    expect(screen.getByTestId('bulk-selector')).toBeDefined();
  });

  it('toggles back to single mode', () => {
    renderDialog();
    fireEvent.click(screen.getByText('tradingProfiles.watchers.bulkMode'));
    fireEvent.click(screen.getByText('tradingProfiles.watchers.singleMode'));
    expect(screen.getByTestId('symbol-input')).toBeDefined();
    expect(screen.queryByTestId('bulk-selector')).toBeNull();
  });

  it('starts with "use wallet default" checked → no profile selector visible', () => {
    renderDialog();
    expect(screen.queryByText('tradingProfiles.watchers.profile')).toBeNull();
  });

  it('renders FUTURES warning Callout by default', () => {
    renderDialog();
    expect(screen.getByText('tradingProfiles.watchers.futuresWarning')).toBeDefined();
  });

  it('renders informational Callout footer', () => {
    renderDialog();
    expect(screen.getByText('tradingProfiles.watchers.info')).toBeDefined();
  });

  it('disables submit when symbol is empty', () => {
    // Reset symbol to empty by changing SymbolSelector input
    renderDialog();
    fireEvent.change(screen.getByTestId('symbol-input'), { target: { value: '' } });
    const startBtn = screen.getByRole('button', { name: 'tradingProfiles.watchers.start' });
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit when default symbol is present', () => {
    // Default symbol is BTCUSDT — submit should be enabled
    renderDialog();
    const startBtn = screen.getByRole('button', { name: 'tradingProfiles.watchers.start' });
    expect((startBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
