import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CollapsibleSection } from './CollapsibleSection';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('CollapsibleSection', () => {
  it('should render title', () => {
    renderWithChakra(
      <CollapsibleSection title="Settings">
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should be collapsed by default', () => {
    const onToggle = vi.fn();
    renderWithChakra(
      <CollapsibleSection title="Settings" onToggle={onToggle}>
        <span data-testid="content">Hidden Content</span>
      </CollapsibleSection>
    );

    const content = screen.getByTestId('content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
  });

  it('should be expanded when defaultOpen is true', () => {
    renderWithChakra(
      <CollapsibleSection title="Settings" defaultOpen={true}>
        <span data-testid="content">Visible Content</span>
      </CollapsibleSection>
    );

    const content = screen.getByTestId('content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'open');
  });

  it('should toggle content state on click', async () => {
    const user = userEvent.setup();

    renderWithChakra(
      <CollapsibleSection title="Settings">
        <span data-testid="content">Toggle Content</span>
      </CollapsibleSection>
    );

    const content = screen.getByTestId('content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'closed');

    await user.click(screen.getByText('Settings'));
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'open');

    await user.click(screen.getByText('Settings'));
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
  });

  it('should call onToggle when toggled', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <CollapsibleSection title="Settings" onToggle={onToggle}>
        <span>Content</span>
      </CollapsibleSection>
    );

    await user.click(screen.getByText('Settings'));
    expect(onToggle).toHaveBeenCalledWith(true);

    await user.click(screen.getByText('Settings'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('should render header action', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <CollapsibleSection
        title="Settings"
        headerAction={<button onClick={onClick}>Action</button>}
      >
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByText('Action')).toBeInTheDocument();
    await user.click(screen.getByText('Action'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not toggle when clicking header action', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <CollapsibleSection
        title="Settings"
        onToggle={onToggle}
        headerAction={<button>Action</button>}
      >
        <span>Content</span>
      </CollapsibleSection>
    );

    await user.click(screen.getByText('Action'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('should render badge', () => {
    renderWithChakra(
      <CollapsibleSection title="Items" badge={<span>5</span>}>
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should apply different sizes', () => {
    const { rerender } = renderWithChakra(
      <CollapsibleSection title="Small" size="sm">
        <span>Content</span>
      </CollapsibleSection>
    );
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <CollapsibleSection title="Medium" size="md">
          <span>Content</span>
        </CollapsibleSection>
      </ChakraProvider>
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('should render description', () => {
    renderWithChakra(
      <CollapsibleSection title="Settings" description="Configure your preferences">
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByText('Configure your preferences')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    renderWithChakra(
      <CollapsibleSection title="Settings">
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.queryByText('Configure your preferences')).not.toBeInTheDocument();
  });

  it('should support size lg', () => {
    renderWithChakra(
      <CollapsibleSection title="Large Section" size="lg" description="A large section">
        <span>Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByText('Large Section')).toBeInTheDocument();
    expect(screen.getByText('A large section')).toBeInTheDocument();
  });

  it('should work in controlled mode with open prop', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = renderWithChakra(
      <CollapsibleSection title="Controlled" open={false} onOpenChange={onOpenChange}>
        <span data-testid="content">Content</span>
      </CollapsibleSection>
    );

    expect(screen.getByTestId('content').closest('[data-state]')).toHaveAttribute('data-state', 'closed');

    await user.click(screen.getByText('Controlled'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('content').closest('[data-state]')).toHaveAttribute('data-state', 'closed');

    rerender(
      <ChakraProvider value={defaultSystem}>
        <CollapsibleSection title="Controlled" open={true} onOpenChange={onOpenChange}>
          <span data-testid="content">Content</span>
        </CollapsibleSection>
      </ChakraProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('content').closest('[data-state]')).toHaveAttribute('data-state', 'open');
    });
  });

  it('should not update internal state in controlled mode', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <CollapsibleSection title="Controlled" open={false} onOpenChange={onOpenChange}>
        <span data-testid="content">Content</span>
      </CollapsibleSection>
    );

    await user.click(screen.getByText('Controlled'));
    await user.click(screen.getByText('Controlled'));

    const content = screen.getByTestId('content');
    expect(content.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});
