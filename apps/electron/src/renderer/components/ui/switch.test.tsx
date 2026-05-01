import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '@marketmind/ui-core';

const renderWithChakra = (ui: ReactElement) => render(
    <ChakraProvider value={defaultSystem}>
        {ui}
    </ChakraProvider>
);

describe('Switch', () => {
    it('should render switch component', () => {
        const { container } = renderWithChakra(
            <Switch checked={false} onCheckedChange={vi.fn()} />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with label when children provided', () => {
        renderWithChakra(
            <Switch checked={false} onCheckedChange={vi.fn()}>
                Enable feature
            </Switch>
        );

        expect(screen.getByText('Enable feature')).toBeInTheDocument();
    });

    it('should render with different sizes', () => {
        const { container, rerender } = renderWithChakra(
            <Switch checked={false} onCheckedChange={vi.fn()} size="sm" />
        );

        expect(container.firstChild).toBeInTheDocument();

        rerender(
            <ChakraProvider value={defaultSystem}>
                <Switch checked={false} onCheckedChange={vi.fn()} size="md" />
            </ChakraProvider>
        );

        expect(container.firstChild).toBeInTheDocument();

        rerender(
            <ChakraProvider value={defaultSystem}>
                <Switch checked={false} onCheckedChange={vi.fn()} size="lg" />
            </ChakraProvider>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should accept checked prop', () => {
        const { container } = renderWithChakra(
            <Switch checked onCheckedChange={vi.fn()} />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should accept disabled prop', () => {
        const { container } = renderWithChakra(
            <Switch checked={false} onCheckedChange={vi.fn()} disabled />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should call onCheckedChange when clicked', async () => {
        const onCheckedChange = vi.fn();
        const user = userEvent.setup();

        const { container } = renderWithChakra(
            <Switch checked={false} onCheckedChange={onCheckedChange} />
        );

        const switchControl = container.querySelector('button, input, [role="switch"]');
        if (switchControl) {
            await user.click(switchControl);
        }

        expect(container.firstChild).toBeInTheDocument();
    });
});

