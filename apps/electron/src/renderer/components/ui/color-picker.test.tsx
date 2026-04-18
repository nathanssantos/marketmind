import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ColorPicker, DEFAULT_COLOR_PRESETS } from './color-picker';

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('ColorPicker', () => {
  it('renders trigger button with current color', () => {
    renderWithChakra(<ColorPicker value="#ff0000" onChange={vi.fn()} ariaLabel="pick" />);
    const trigger = screen.getByRole('button', { name: 'pick' });
    expect(trigger).toBeInTheDocument();
  });

  it('opens preset grid on click', async () => {
    const user = userEvent.setup();
    renderWithChakra(<ColorPicker value="#ffffff" onChange={vi.fn()} ariaLabel="pick" />);

    const trigger = screen.getByRole('button', { name: 'pick' });
    await user.click(trigger);

    for (const preset of DEFAULT_COLOR_PRESETS) {
      expect(screen.getByRole('button', { name: preset })).toBeInTheDocument();
    }
  });

  it('calls onChange with preset hex when a swatch is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithChakra(<ColorPicker value="#ffffff" onChange={onChange} ariaLabel="pick" />);

    await user.click(screen.getByRole('button', { name: 'pick' }));
    await user.click(screen.getByRole('button', { name: '#ef4444' }));

    expect(onChange).toHaveBeenCalledWith('#ef4444');
  });

  it('commits valid hex input on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithChakra(<ColorPicker value="#ffffff" onChange={onChange} ariaLabel="pick" />);

    await user.click(screen.getByRole('button', { name: 'pick' }));
    const hexInput = screen.getByPlaceholderText('#rrggbb');
    await user.clear(hexInput);
    await user.type(hexInput, '#123abc');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('#123abc');
  });

  it('ignores invalid hex input', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithChakra(<ColorPicker value="#ffffff" onChange={onChange} ariaLabel="pick" />);

    await user.click(screen.getByRole('button', { name: 'pick' }));
    const hexInput = screen.getByPlaceholderText('#rrggbb');
    await user.clear(hexInput);
    await user.type(hexInput, 'notahex');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('normalizes hex without # prefix', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithChakra(<ColorPicker value="#ffffff" onChange={onChange} ariaLabel="pick" />);

    await user.click(screen.getByRole('button', { name: 'pick' }));
    const hexInput = screen.getByPlaceholderText('#rrggbb') as HTMLInputElement;
    fireEvent.change(hexInput, { target: { value: 'abcdef' } });
    fireEvent.blur(hexInput);

    expect(onChange).toHaveBeenCalledWith('#abcdef');
  });

  it('respects disabled prop', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithChakra(
      <ColorPicker value="#ffffff" onChange={onChange} disabled ariaLabel="pick" />,
    );

    const trigger = screen.getByRole('button', { name: 'pick' });
    await user.click(trigger);

    expect(screen.queryByPlaceholderText('#rrggbb')).not.toBeInTheDocument();
  });
});
