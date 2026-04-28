import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LuAlertCircle } from 'react-icons/lu';

import { EmptyState } from './EmptyState';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('EmptyState', () => {
  it('should render title', () => {
    renderWithChakra(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    renderWithChakra(
      <EmptyState title="No items" description="Try adding some items to get started" />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Try adding some items to get started')).toBeInTheDocument();
  });

  it('should render action button when provided', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderWithChakra(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onClick }}
      />
    );

    const button = screen.getByRole('button', { name: 'Add Item' });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should render custom icon', () => {
    const { container } = renderWithChakra(
      <EmptyState title="Error" icon={LuAlertCircle} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render children', () => {
    renderWithChakra(
      <EmptyState title="Empty">
        <span>Custom child content</span>
      </EmptyState>
    );
    expect(screen.getByText('Custom child content')).toBeInTheDocument();
  });

  it('should apply different sizes', () => {
    const { rerender } = renderWithChakra(
      <EmptyState title="Small" size="sm" />
    );
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <EmptyState title="Medium" size="md" />
      </ChakraProvider>
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <EmptyState title="Large" size="lg" />
      </ChakraProvider>
    );
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('should apply custom color palette to action button', async () => {
    const onClick = vi.fn();

    renderWithChakra(
      <EmptyState
        title="No items"
        action={{ label: 'Add', onClick, colorPalette: 'green' }}
      />
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('should wrap in dashed border when dashed prop is set', () => {
    const { container } = renderWithChakra(
      <EmptyState title="No items" dashed />
    );

    const wrapper = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(wrapper);
    expect(wrapper.tagName.toLowerCase()).toBe('div');
    expect(style.borderStyle).toBe('dashed');
  });

  it('should not wrap by default', () => {
    const { container } = renderWithChakra(<EmptyState title="No items" />);
    const root = container.firstChild as HTMLElement;
    const style = window.getComputedStyle(root);
    expect(style.borderStyle === 'dashed').toBe(false);
  });
});
