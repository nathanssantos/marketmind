import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmationDialog } from './ConfirmationDialog';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('ConfirmationDialog', () => {
  it('should render dialog when open', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm Action"
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm Action"
      />
    );

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('should render description when provided', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Are you sure you want to delete this item?"
      />
    );

    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('should render ReactNode description', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description={<strong>Important warning</strong>}
      />
    );

    expect(screen.getByText('Important warning')).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Confirm"
      />
    );

    await user.click(screen.getByText('common.cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Confirm"
      />
    );

    await user.click(screen.getByText('common.save'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should show delete label for destructive actions', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete"
        isDestructive={true}
      />
    );

    expect(screen.getByText('common.delete')).toBeInTheDocument();
  });

  it('should show custom confirm label', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm"
        confirmLabel="Yes, proceed"
      />
    );

    expect(screen.getByText('Yes, proceed')).toBeInTheDocument();
  });

  it('should show custom cancel label', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm"
        cancelLabel="No, go back"
      />
    );

    expect(screen.getByText('No, go back')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm"
        isLoading={true}
      />
    );

    expect(screen.getByText('common.cancel')).toBeDisabled();
  });

  it('should not close when loading', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <ConfirmationDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Confirm"
        isLoading={true}
      />
    );

    await user.click(screen.getByText('common.cancel'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
