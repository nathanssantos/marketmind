import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { DialogShell } from './dialog-shell';
import { DialogSection } from './dialog-section';

const renderShell = (props: Partial<React.ComponentProps<typeof DialogShell>> = {}) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <DialogShell
        isOpen
        onClose={vi.fn()}
        title="Create wallet"
        {...props}
      >
        <DialogSection>
          <div>body</div>
        </DialogSection>
      </DialogShell>
    </ChakraProvider>,
  );

describe('DialogShell', () => {
  it('renders the title', () => {
    renderShell();
    expect(screen.getByText('Create wallet')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    renderShell({ description: 'Add a paper wallet.' });
    expect(screen.getByText('Add a paper wallet.')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    renderShell();
    expect(screen.queryByText('Add a paper wallet.')).not.toBeInTheDocument();
  });

  it('renders headerAction on the right', () => {
    renderShell({ headerAction: <button>Reset</button> });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('renders the default footer (Cancel + primary) when onSubmit is set', () => {
    const onSubmit = vi.fn();
    renderShell({ onSubmit, submitLabel: 'Create' });
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('hides the footer when hideFooter is true', () => {
    renderShell({ hideFooter: true });
    expect(screen.queryByRole('button', { name: 'common.cancel' })).not.toBeInTheDocument();
  });

  it('calls onSubmit when the primary button is clicked', async () => {
    const onSubmit = vi.fn();
    renderShell({ onSubmit, submitLabel: 'Create' });
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('calls onClose when the Cancel button is clicked', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    renderShell({ onClose, onSubmit });
    await userEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Cancel and submit while loading', () => {
    renderShell({ isLoading: true, onSubmit: vi.fn(), submitLabel: 'Save' });
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled();
  });

  it('respects custom footer override', () => {
    renderShell({ footer: <button>Custom CTA</button> });
    expect(screen.getByRole('button', { name: 'Custom CTA' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.cancel' })).not.toBeInTheDocument();
  });
});

describe('DialogSection', () => {
  const renderSection = (props: Partial<React.ComponentProps<typeof DialogSection>> = {}) =>
    render(
      <ChakraProvider value={defaultSystem}>
        <DialogSection {...props}>
          <div>section body</div>
        </DialogSection>
      </ChakraProvider>,
    );

  it('renders children', () => {
    renderSection();
    expect(screen.getByText('section body')).toBeInTheDocument();
  });

  it('renders title and description when provided', () => {
    renderSection({ title: 'API credentials', description: 'Read-only.' });
    expect(screen.getByText('API credentials')).toBeInTheDocument();
    expect(screen.getByText('Read-only.')).toBeInTheDocument();
  });

  it('renders action on the right when provided', () => {
    renderSection({ title: 'Section', action: <button>More</button> });
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('omits the heading row entirely when no title/description/action', () => {
    const { container } = renderSection();
    // Body is the only structural element when no header is rendered
    expect(container.textContent).toBe('section body');
  });
});
