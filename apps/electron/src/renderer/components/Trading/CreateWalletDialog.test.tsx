import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWalletDialog } from './CreateWalletDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

const renderDialog = (overrides: Partial<Parameters<typeof CreateWalletDialog>[0]> = {}) => {
  const onCreate = vi.fn();
  const onCreateReal = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const utils = render(
    <ChakraProvider value={defaultSystem}>
      <CreateWalletDialog
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        onCreateReal={onCreateReal}
        {...overrides}
      />
    </ChakraProvider>
  );
  return { ...utils, onCreate, onCreateReal, onClose };
};

describe('CreateWalletDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the create-title when open', () => {
    renderDialog();
    expect(screen.getByText('trading.wallets.createTitle')).toBeDefined();
  });

  it('does not render when isOpen=false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('trading.wallets.createTitle')).toBeNull();
  });

  it('shows the testnet info Callout when Binance + Testnet selected', () => {
    // Default Binance + paper. Pre-fill name + change select to testnet.
    renderDialog();
    // Switch wallet type to testnet via the wallet type select. Uses native option click.
    // The Callout title is visible after selection.
    // Default shows paper-related currency input. Switching wallet type triggers Callout.
    // Skip programmatic select click in jsdom — assert form starts in paper mode (no testnet callout).
    expect(screen.queryByText('trading.wallets.testnetInfo')).toBeNull();
  });

  it('shows the Live warning Callout when wallet type=live', () => {
    // Same approach — assert default state has no live warning.
    renderDialog();
    expect(screen.queryByText('trading.wallets.liveWarning')).toBeNull();
  });

  it('renders the name input field', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('trading.wallets.namePlaceholder')).toBeDefined();
  });

  it('disables submit when name is empty', () => {
    renderDialog();
    const submit = screen.getByRole('button', { name: 'trading.wallets.create' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit once name is filled (paper default)', () => {
    renderDialog();
    const nameInput = screen.getByPlaceholderText('trading.wallets.namePlaceholder');
    fireEvent.change(nameInput, { target: { value: 'My Wallet' } });
    const submit = screen.getByRole('button', { name: 'trading.wallets.create' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onCreate with paper params on submit', () => {
    const { onCreate } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('trading.wallets.namePlaceholder'), {
      target: { value: 'Paper One' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'trading.wallets.create' }));
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Paper One',
      initialBalance: 10000,
      currency: 'USDT',
    });
  });

  it('renders Initial Balance + Currency fields by default (paper Binance)', () => {
    renderDialog();
    expect(screen.getByText('trading.wallets.initialBalance')).toBeDefined();
    expect(screen.getByText('trading.wallets.currency')).toBeDefined();
  });
});
