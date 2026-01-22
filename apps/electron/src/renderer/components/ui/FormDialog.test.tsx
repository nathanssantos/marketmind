import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FormDialog } from './FormDialog';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('FormDialog', () => {
  it('should render dialog when open', () => {
    renderWithChakra(
      <FormDialog isOpen={true} onClose={vi.fn()} title="Test Dialog">
        <span>Dialog content</span>
      </FormDialog>
    );

    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithChakra(
      <FormDialog isOpen={false} onClose={vi.fn()} title="Test Dialog">
        <span>Dialog content</span>
      </FormDialog>
    );

    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <FormDialog isOpen={true} onClose={onClose} title="Test" onSubmit={vi.fn()}>
        Content
      </FormDialog>
    );

    await user.click(screen.getByText('common.cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit when submit button is clicked', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <FormDialog isOpen={true} onClose={vi.fn()} title="Test" onSubmit={onSubmit}>
        Content
      </FormDialog>
    );

    await user.click(screen.getByText('common.save'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should show custom submit label', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        onSubmit={vi.fn()}
        submitLabel="Create Item"
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('Create Item')).toBeInTheDocument();
  });

  it('should disable submit button when submitDisabled is true', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        onSubmit={vi.fn()}
        submitDisabled={true}
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('should show loading state', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        onSubmit={vi.fn()}
        isLoading={true}
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('common.cancel')).toBeDisabled();
  });

  it('should render custom footer', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        footer={<button>Custom Footer</button>}
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('Custom Footer')).toBeInTheDocument();
  });

  it('should hide footer when hideFooter is true', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        onSubmit={vi.fn()}
        hideFooter={true}
      >
        Content
      </FormDialog>
    );

    expect(screen.queryByText('common.save')).not.toBeInTheDocument();
    expect(screen.queryByText('common.cancel')).not.toBeInTheDocument();
  });

  it('should not close when loading', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={onClose}
        title="Test"
        onSubmit={vi.fn()}
        isLoading={true}
      >
        Content
      </FormDialog>
    );

    await user.click(screen.getByText('common.cancel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render with custom bodyPadding', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        bodyPadding={0}
        hideFooter
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render with contentMaxH', () => {
    renderWithChakra(
      <FormDialog
        isOpen={true}
        onClose={vi.fn()}
        title="Test"
        contentMaxH="90vh"
        hideFooter
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
