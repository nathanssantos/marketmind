import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui/color-mode';

const reversePositionMock = vi.fn();
const closePositionAndCancelOrdersMock = vi.fn();
const errorMock = vi.fn();
const warningMock = vi.fn();
const useBackendFuturesTradingMock = vi.fn();
const useToastMock = vi.fn();

vi.mock('@renderer/hooks/useBackendFuturesTrading', () => ({
  useBackendFuturesTrading: (walletId: string) => useBackendFuturesTradingMock(walletId),
}));

vi.mock('@renderer/hooks/useToast', () => ({
  useToast: () => useToastMock(),
}));

import { PositionActionsPopover } from './PositionActionsPopover';

const renderPopover = (props: Partial<React.ComponentProps<typeof PositionActionsPopover>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <PositionActionsPopover
          open
          onOpenChange={vi.fn()}
          anchorRect={{ x: 10, y: 20, width: 14, height: 14 }}
          symbol="BTCUSDT"
          walletId="w1"
          currentPosition={{ id: 'pos-1', side: 'LONG', quantity: '0.5' }}
          {...props}
        />
      </ColorModeProvider>
    </ChakraProvider>,
  );

beforeEach(() => {
  useBackendFuturesTradingMock.mockReturnValue({
    positions: [],
    reversePosition: reversePositionMock,
    isReversingPosition: false,
    closePositionAndCancelOrders: closePositionAndCancelOrdersMock,
    isClosingPositionAndCancellingOrders: false,
    cancelAllOrders: vi.fn(),
    isCancellingAllOrders: false,
  });
  useToastMock.mockReturnValue({ error: errorMock, warning: warningMock });
  reversePositionMock.mockResolvedValue({ success: true });
  closePositionAndCancelOrdersMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

const findMenuItem = async (labelKey: string) =>
  within(await screen.findByTestId('position-actions-menu')).getByText(labelKey);

describe('PositionActionsPopover', () => {
  it('renders both menu items when open with valid anchor', async () => {
    renderPopover();
    const menu = await screen.findByTestId('position-actions-menu');
    expect(within(menu).getByText('futures.reversePosition')).toBeInTheDocument();
    expect(within(menu).getByText('futures.closePosition')).toBeInTheDocument();
  });

  it('does not render menu when open=false', () => {
    renderPopover({ open: false });
    expect(screen.queryByTestId('position-actions-menu')).toBeNull();
  });

  it('renders an invisible anchor box at the supplied rect coords', () => {
    renderPopover({ anchorRect: { x: 33, y: 44, width: 14, height: 14 } });
    const anchor = screen.getByTestId('position-actions-anchor');
    expect(anchor).toHaveStyle({ left: '33px', top: '44px', width: '14px', height: '14px' });
  });

  it('disables items when currentPosition is null', async () => {
    renderPopover({ currentPosition: null });
    const menu = await screen.findByTestId('position-actions-menu');
    const reverse = within(menu).getByText('futures.reversePosition').closest('[role="menuitem"]');
    const close = within(menu).getByText('futures.closePosition').closest('[role="menuitem"]');
    expect(reverse).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-disabled', 'true');
  });

  it('click Reverse opens confirmation; confirm fires reversePosition with walletId + symbol + positionId', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await user.click(await findMenuItem('futures.reversePosition'));
    const dialog = (await screen.findByText('futures.reverseConfirmTitle')).closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    await waitFor(() => expect(reversePositionMock).toHaveBeenCalledTimes(1));
    expect(reversePositionMock).toHaveBeenCalledWith({ walletId: 'w1', symbol: 'BTCUSDT', positionId: 'pos-1' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('click Close opens confirmation; confirm fires closePositionAndCancelOrders', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await user.click(await findMenuItem('futures.closePosition'));
    const dialog = (await screen.findByText('futures.closePositionConfirmTitle')).closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.closePosition/i }));

    await waitFor(() => expect(closePositionAndCancelOrdersMock).toHaveBeenCalledTimes(1));
    expect(closePositionAndCancelOrdersMock).toHaveBeenCalledWith({ walletId: 'w1', symbol: 'BTCUSDT', positionId: 'pos-1' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('surfaces a toast and keeps popover open when reverse mutation rejects', async () => {
    reversePositionMock.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await user.click(await findMenuItem('futures.reversePosition'));
    const dialog = (await screen.findByText('futures.reverseConfirmTitle')).closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.reversePosition/i }));

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith('futures.reverseFailed', 'boom'));
    // onOpenChange must NOT be called with false on error — popover stays open for retry
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('surfaces a toast and keeps popover open when close mutation rejects', async () => {
    closePositionAndCancelOrdersMock.mockRejectedValueOnce(new Error('nope'));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await user.click(await findMenuItem('futures.closePosition'));
    const dialog = (await screen.findByText('futures.closePositionConfirmTitle')).closest('[role="dialog"]')!;
    await user.click(within(dialog).getByRole('button', { name: /futures\.closePosition/i }));

    await waitFor(() => expect(errorMock).toHaveBeenCalledWith('futures.closePositionFailed', 'nope'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('dismissing the confirmation does NOT call the mutation', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(await findMenuItem('futures.reversePosition'));
    const dialog = (await screen.findByText('futures.reverseConfirmTitle')).closest('[role="dialog"]')!;
    // Find the cancel button — Chakra ConfirmationDialog renders one labeled with the cancel key
    const cancelBtn = within(dialog).getByRole('button', { name: /common\.cancel/i });
    await user.click(cancelBtn);

    expect(reversePositionMock).not.toHaveBeenCalled();
  });
});
